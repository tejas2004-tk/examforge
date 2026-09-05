import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import axios from 'axios';

const AI = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: 60000,
});

export async function createConversation(userId: string, input: { title?: string; topic?: string; courseId?: string }) {
  return prisma.aIConversation.create({
    data: { ...input, userId },
    include: { messages: true },
  });
}

export async function listConversations(userId: string) {
  return prisma.aIConversation.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getConversation(id: string, userId: string) {
  const conv = await prisma.aIConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conv || conv.userId !== userId) throw new AppError(404, 'Conversation not found');
  return conv;
}

export async function sendTutorMessage(userId: string, conversationId: string, content: string) {
  const conv = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.userId !== userId) throw new AppError(404, 'Conversation not found');

  await prisma.aIMessage.create({
    data: { conversationId, role: 'user', content },
  });

  try {
    // Call AI service if configured
    let reply = '';
    let sources: unknown = null;

    if (env.AI_PROVIDER !== 'external' || env.OPENAI_API_KEY) {
      const history = await prisma.aIMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      const resp = await AI.post('/tutor', {
        conversationId,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        topic: conv.topic,
        courseId: conv.courseId,
      });
      reply = resp.data?.reply ?? 'No response from AI service';
      sources = resp.data?.sources ?? null;
    } else {
      reply = `[Demo] You asked: "${content}". Connect an AI service (OPENAI_API_KEY) for full RAG tutoring.`;
    }

    const assistantMsg = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: reply,
        sources: sources as any,
      },
    });

    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return assistantMsg;
  } catch (err: any) {
    const reply = `[Error] ${err?.message ?? 'AI service unavailable'}. Please try again later.`;
    return prisma.aIMessage.create({
      data: { conversationId, role: 'assistant', content: reply },
    });
  }
}

export async function deleteConversation(id: string, userId: string) {
  const conv = await prisma.aIConversation.findUnique({ where: { id } });
  if (!conv || conv.userId !== userId) throw new AppError(404, 'Conversation not found');
  await prisma.aIConversation.delete({ where: { id } });
  return { deleted: true };
}

export async function generateQuestions(input: {
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
  type?: string;
  createdById: string;
}) {
  if (env.AI_PROVIDER === 'external' && !env.OPENAI_API_KEY) {
    throw new AppError(503, 'AI service not configured. Set AI_PROVIDER and the provider credentials.');
  }
  const resp = await AI.post('/generate-questions', input);
  return resp.data;
}

export async function analyzeResult(attemptId: string, viewer: { id: string; role: string }) {
  if (env.AI_PROVIDER === 'external' && !env.OPENAI_API_KEY) {
    throw new AppError(503, 'AI service not configured. Set AI_PROVIDER and the provider credentials.');
  }
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: true,
      answers: { include: { question: true } },
    },
  });
  if (!attempt) throw new AppError(404, 'Attempt not found');
  if (viewer.role === 'STUDENT' && attempt.studentId !== viewer.id) throw new AppError(403, 'Not authorized');
  if (viewer.role === 'TEACHER' && attempt.test.createdById !== viewer.id) throw new AppError(403, 'Not authorized');

  const resp = await AI.post('/analyze-result', { attempt });
  return resp.data;
}

export async function getRecommendations(studentId: string, viewer: { id: string; role: string }) {
  if (viewer.role === 'STUDENT' && studentId !== viewer.id) throw new AppError(403, 'Not authorized');
  if (viewer.role !== 'ADMIN' && viewer.role !== 'TEACHER' && viewer.id !== studentId) throw new AppError(403, 'Not authorized');
  // If AI service available, fetch dynamic recommendations; otherwise create from data
  let recommendations: any[] = [];

  if (env.OPENAI_API_KEY) {
    try {
      const resp = await AI.get(`/recommendations/${studentId}`);
      recommendations = resp.data?.recommendations ?? [];
    } catch {
      recommendations = [];
    }
  }

  // Always compute from existing data
  const lowAccuracyQuestions = await prisma.questionAnalytics.findMany({
    where: { accuracy: { lt: 50 }, attemptCount: { gt: 0 } },
    orderBy: { accuracy: 'asc' },
    take: 5,
    include: { question: { select: { id: true, text: true, topic: true } } },
  });

  const existingRecommendations = await prisma.recommendation.findMany({
    where: { userId: studentId, isRead: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    aiGenerated: recommendations,
    dataDriven: lowAccuracyQuestions.map((q) => ({
      type: 'TOPIC',
      title: `Review: ${q.question.topic ?? q.question.text.slice(0, 40)}`,
      description: `Your accuracy on this topic is below 50%. Consider revisiting the relevant lessons.`,
      data: { questionId: q.question.id },
    })),
    stored: existingRecommendations,
  };
}