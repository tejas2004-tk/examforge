import { execFile as execFileOriginal, spawn } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFile = promisify(execFileOriginal);

interface TestResult {
  passed: boolean;
  expected: string;
  actual: string;
  runtimeMs: number;
}

interface SubmissionResult {
  status: string;
  results: TestResult[];
  passedCount: number;
  totalCount: number;
  executionTime?: number;
  memoryUsed?: number;
  output?: string;
  error?: string;
}

const LANG_CONFIG: Record<string, { ext: string; command: string; args: (file: string) => string[] }> = {
  python: {
    ext: 'py',
    command: 'python',
    args: (file) => [file],
  },
  javascript: {
    ext: 'js',
    command: 'node',
    args: (file) => [file],
  },
  java: {
    ext: 'java',
    command: 'java',
    args: (file) => ['-cp', path.dirname(file), path.basename(file, '.java')],
  },
};

const runProcess = (command: string, args: string[], input: string, timeoutMs: number) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(stderr || `Process exited with code ${code}`), { stderr }));
    });
    child.stdin.end(input);
  });

export async function createCodingProblem(input: {
  title: string;
  description: string;
  courseId?: string;
  difficulty?: string;
  timeLimitMs?: number;
  memoryLimitMB?: number;
  allowedLanguages?: string[];
  solution?: string;
  testCases?: Array<{ input?: string; expectedOutput: string; isPublic?: boolean; orderIndex?: number }>;
  createdById: string;
}) {
  const languages = input.allowedLanguages?.length ? input.allowedLanguages : ['python', 'javascript'];

  const problem = await prisma.codingProblem.create({
    data: {
      title: input.title,
      description: input.description,
      courseId: input.courseId,
      difficulty: (input.difficulty as any) ?? 'MEDIUM',
      timeLimitMs: input.timeLimitMs ?? 2000,
      memoryLimitMB: input.memoryLimitMB ?? 256,
      allowedLanguages: JSON.stringify(languages),
      solution: input.solution,
      createdById: input.createdById,
      ...(input.testCases?.length ? {
        testCases: {
          create: input.testCases.map((tc, i) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isPublic: tc.isPublic ?? true,
            orderIndex: tc.orderIndex ?? i,
          })),
        },
      } : {}),
    },
    include: { testCases: true },
  });

  return problem;
}

export async function listCodingProblems(query: { page?: number; limit?: number; courseId?: string }, role?: string) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.courseId) where.courseId = query.courseId;

  const [items, total] = await Promise.all([
    prisma.codingProblem.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.codingProblem.count({ where }),
  ]);
  return {
    items: role === 'STUDENT' ? items.map(({ solution: _solution, ...problem }) => problem) : items,
    total,
    page,
    limit,
  };
}

export async function getCodingProblem(id: string, userId: string, role: string) {
  const problem = await prisma.codingProblem.findUnique({
    where: { id },
    include: {
      testCases: { where: { isPublic: true }, orderBy: { orderIndex: 'asc' } },
      submissions: { where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!problem) throw new AppError(404, 'Coding problem not found');
  if (role === 'STUDENT') {
    const { solution: _solution, ...studentProblem } = problem;
    return studentProblem;
  }
  return problem;
}

export async function updateCodingProblem(id: string, viewer: { id: string; role: string }, input: any) {
  const existing = await prisma.codingProblem.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Coding problem not found');
  if (viewer.role !== 'ADMIN' && existing.createdById !== viewer.id) throw new AppError(403, 'Not authorized');

  return prisma.codingProblem.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      courseId: input.courseId,
      difficulty: input.difficulty as any,
      timeLimitMs: input.timeLimitMs,
      memoryLimitMB: input.memoryLimitMB,
      solution: input.solution,
      ...(input.allowedLanguages?.length
        ? { allowedLanguages: JSON.stringify(input.allowedLanguages) }
        : {}),
    },
  });
}

export async function deleteCodingProblem(id: string, viewer: { id: string; role: string }) {
  const existing = await prisma.codingProblem.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Coding problem not found');
  if (viewer.role !== 'ADMIN' && existing.createdById !== viewer.id) throw new AppError(403, 'Not authorized');
  await prisma.codingProblem.delete({ where: { id } });
  return { deleted: true };
}

export async function addTestCase(problemId: string, input: { input?: string; expectedOutput: string; isPublic?: boolean }) {
  const problem = await prisma.codingProblem.findUnique({ where: { id: problemId } });
  if (!problem) throw new AppError(404, 'Coding problem not found');

  const maxOrder = await prisma.codingTestCase.aggregate({ where: { problemId }, _max: { orderIndex: true } });
  return prisma.codingTestCase.create({
    data: { ...input, problemId, orderIndex: (maxOrder._max.orderIndex ?? -1) + 1 },
  });
}

export async function deleteTestCase(id: string) {
  const tc = await prisma.codingTestCase.findUnique({ where: { id } });
  if (!tc) throw new AppError(404, 'Test case not found');
  await prisma.codingTestCase.delete({ where: { id } });
  return { deleted: true };
}

export async function executeCode(problemId: string, userId: string, language: string, code: string): Promise<SubmissionResult> {
  const problem = await prisma.codingProblem.findUnique({
    where: { id: problemId },
    include: { testCases: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!problem) throw new AppError(404, 'Coding problem not found');

  const allowed = JSON.parse(problem.allowedLanguages as string);
  if (!allowed.includes(language)) throw new AppError(400, `Language '${language}' not allowed for this problem`);

  const config = LANG_CONFIG[language];
  if (!config) throw new AppError(400, `Unsupported language: ${language}`);

  // Write code to temp file and execute with test cases
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'examforge-'));
  const filePath = path.join(dir, `solution.${config.ext}`);
  fs.writeFileSync(filePath, code);

  let results: TestResult[] = [];
  let error: string | undefined;
  let executionTime = 0;

  try {
    if (language === 'java') {
      await execFile('javac', ['-d', dir, filePath], { timeout: problem.timeLimitMs || 2000 });
    }
    for (const tc of problem.testCases) {
      const startTime = Date.now();
      try {
        const { stdout } = await runProcess(config.command, config.args(filePath), tc.input ?? '', problem.timeLimitMs || 2000);
        const runtime = Date.now() - startTime;
        executionTime += runtime;
        const actual = stdout.trim();
        const expected = tc.expectedOutput.trim();
        results.push({
          passed: actual === expected,
          expected,
          actual,
          runtimeMs: runtime,
        });
      } catch (err: any) {
        const runtime = Date.now() - startTime;
        executionTime += runtime;
        results.push({
          passed: false,
          expected: tc.expectedOutput.trim(),
          actual: String(err?.stderr ?? err?.message ?? 'Error'),
          runtimeMs: runtime,
        });
      }
    }
  } catch (err: any) {
    error = err?.message ?? 'Execution failed';
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const status = error ? 'ERROR' : passedCount === results.length ? 'ACCEPTED' : 'FAILED';

  const result: SubmissionResult = {
    status,
    results,
    passedCount,
    totalCount: results.length,
    executionTime,
    error,
  };

  // Persist
  await prisma.codeSubmission.create({
    data: {
      problemId,
      userId,
      language,
      code,
      status,
      result: result as any,
      executionTime,
    },
  });

  return result;
}

export async function listSubmissions(problemId: string, userId?: string) {
  const where: any = { problemId };
  if (userId) where.userId = userId;
  return prisma.codeSubmission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getSubmission(id: string, viewer: { id: string; role: string }) {
  const sub = await prisma.codeSubmission.findUnique({ where: { id } });
  if (!sub) throw new AppError(404, 'Submission not found');
  if (viewer.role === 'STUDENT' && sub.userId !== viewer.id) throw new AppError(403, 'Not authorized');
  return sub;
}