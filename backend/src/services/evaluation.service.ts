import { Prisma, QuestionType } from '@prisma/client';
import { prisma } from '../config/database.js';

const normalizeText = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

interface LoadedAnswer {
  id: string;
  questionId: string;
  optionId: string | null;
  answerJson: Prisma.JsonValue | null;
}

interface LoadedQuestion {
  id: string;
  type: QuestionType;
  marks: Prisma.Decimal;
  negativeMarks: Prisma.Decimal;
  correctAnswer: Prisma.JsonValue | null;
  options: { id: string; isCorrect: boolean }[];
}

const optionTypes = new Set<QuestionType>([QuestionType.SINGLE, QuestionType.MULTIPLE, QuestionType.TRUE_FALSE]);

function marksForQuestion(
  question: LoadedQuestion,
  answer: LoadedAnswer | undefined,
): { marks: number; isCorrect: boolean | null } {
  const marks = Number(question.marks);
  const negative = Number(question.negativeMarks);

  // Unanswered: no marks, no penalty.
  if (!answer) return { marks: 0, isCorrect: null };
  const json = answer.answerJson;
  const hasNoSelection =
    answer.optionId == null &&
    (json == null ||
      (typeof json === 'string' && !json.trim()) ||
      (Array.isArray(json) && json.length === 0));
  if (hasNoSelection) return { marks: 0, isCorrect: null };

  const fallback = () => (negative > 0 ? { marks: -negative, isCorrect: false } : { marks: 0, isCorrect: false });

  if (optionTypes.has(question.type)) {
    // SINGLE / TRUE_FALSE
    if (question.type !== QuestionType.MULTIPLE) {
      const option = question.options.find((o) => o.id === answer.optionId);
      if (!option) return fallback();
      return option.isCorrect ? { marks, isCorrect: true } : fallback();
    }

    // MULTIPLE
    const selected: string[] = Array.isArray(json && typeof json === 'object' && 'optionIds' in json ? (json as { optionIds?: unknown }).optionIds : null)
      ? ((json as { optionIds: string[] }).optionIds ?? [])
      : [];
    const correctSet = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
    const selectedSet = new Set(selected);
    const exactMatch =
      correctSet.size === selectedSet.size &&
      [...correctSet].every((id) => selectedSet.has(id));
    if (!exactMatch) return fallback();
    return { marks, isCorrect: true };
  }

  if (question.type === QuestionType.FILL_BLANK) {
    const accepted = Array.isArray(question.correctAnswer)
      ? (question.correctAnswer as string[]).map(normalizeText)
      : [String(question.correctAnswer ?? '').trim().toLowerCase()];
    const given = normalizeText(typeof json === 'string' ? json : String((json as { text?: unknown } | null)?.text ?? ''));
    if (given && accepted.includes(given)) {
      return { marks, isCorrect: true };
    }
    return fallback();
  }

  if (question.type === QuestionType.MATCH) {
    const pairs: Record<string, string> = typeof question.correctAnswer === 'object' && question.correctAnswer !== null
      ? (question.correctAnswer as Record<string, string>)
      : {};
    const studentPairs: Record<string, string> = typeof json === 'object' && json !== null && 'pairs' in (json as Record<string, unknown>)
      ? ((json as { pairs?: unknown }).pairs as Record<string, string>) ?? {}
      : {};
    const allCorrect = Object.entries(pairs).every(([k, v]) => studentPairs[k] === v);
    const totalPairs = Object.keys(pairs).length;
    const correctPairs = Object.entries(pairs).filter(([k, v]) => studentPairs[k] === v).length;
    if (totalPairs > 0 && allCorrect) return { marks, isCorrect: true };
    if (totalPairs > 0) {
      const partial = Math.round((correctPairs / totalPairs) * marks * 100) / 100;
      return { marks: Math.max(0, partial), isCorrect: false };
    }
    return fallback();
  }

  // SUBJECTIVE / CODING — teacher grades manually.
  return { marks: 0, isCorrect: null };
}

export async function evaluateAttempt(attemptId: string): Promise<{ score: number; percentage: number; passed: boolean }> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      test: {
        include: {
          testQuestions: {
            include: {
              question: {
                include: { options: { select: { id: true, isCorrect: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!attempt) throw new Error('Attempt not found');

  const questionById = new Map(
    attempt.test.testQuestions.map((tq) => [tq.question.id, tq.question]),
  );
  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

  let score = 0;
  let totalMarks = 0;

  for (const tq of attempt.test.testQuestions) {
    const question = tq.question;
    const qMarks = Number(question.marks);
    totalMarks += qMarks;
    if (totalMarks === 0) continue;

    const answer = answerByQuestion.get(question.id);
    const result = marksForQuestion(question, answer);

    score += result.marks;

    if (answer) {
      await prisma.attemptAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect: result.isCorrect,
          marksObtained: new Prisma.Decimal(result.marks),
        },
      });
    }
  }

  const total = Number(attempt.test.totalMarks) || totalMarks || 1;
  const finalScore = Math.max(0, score);
  const percentage = Math.round((finalScore / total) * 10000) / 100;
  const passed = finalScore >= Number(attempt.test.passingMarks);

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      score: new Prisma.Decimal(Math.round(finalScore * 100) / 100),
      percentage: new Prisma.Decimal(percentage),
      passed,
    },
  });

  return { score: Math.round(finalScore * 100) / 100, percentage, passed };
}

export async function recomputeAttemptScore(attemptId: string): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, test: true },
  });
  if (!attempt) return;

  const total = Number(attempt.test.totalMarks) || 1;
  const score = attempt.answers.reduce((sum, a) => sum + Number(a.marksObtained ?? 0), 0);
  const percentage = Math.round((score / total) * 10000) / 100;
  const passed = score >= Number(attempt.test.passingMarks);

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      score: new Prisma.Decimal(Math.round(score * 100) / 100),
      percentage: new Prisma.Decimal(percentage),
      passed,
    },
  });
}
