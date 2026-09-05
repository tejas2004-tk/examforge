import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

export async function createProctoringSession(input: {
  attemptId?: string;
  testId?: string;
  studentId: string;
  proctorId?: string;
}) {
  const existing = await prisma.proctoringSession.findFirst({
    where: { attemptId: input.attemptId, status: 'ACTIVE' },
  });
  if (existing) return existing;

  return prisma.proctoringSession.create({
    data: {
      attemptId: input.attemptId,
      testId: input.testId,
      studentId: input.studentId,
      proctorId: input.proctorId,
    },
  });
}

export async function endProctoringSession(sessionId: string) {
  const session = await prisma.proctoringSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Proctoring session not found');
  return prisma.proctoringSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date(), status: 'ENDED' },
  });
}

export async function logProctoringEvent(
  sessionId: string,
  event: { type: string; severity?: string; message?: string; metadata?: unknown },
) {
  const session = await prisma.proctoringSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Proctoring session not found');

  const recorded = await prisma.proctoringEvent.create({
    data: {
      sessionId,
      type: event.type,
      severity: event.severity ?? 'LOW',
      message: event.message,
      metadata: event.metadata as any,
    },
  });

  // Recalculate suspicion score: HIGH=10, MEDIUM=5, LOW=2
  const severityWeight = { HIGH: 10, MEDIUM: 5, LOW: 2 };
  const sessionEvents = await prisma.proctoringEvent.findMany({ where: { sessionId } });
  const score = sessionEvents.reduce(
    (sum, e) => sum + (severityWeight[e.severity as keyof typeof severityWeight] ?? 2),
    0,
  );
  await prisma.proctoringSession.update({
    where: { id: sessionId },
    data: { suspicionScore: Math.min(100, score) },
  });

  return recorded;
}

export async function captureSnapshot(sessionId: string, input: { imageUrl?: string; type?: string; metadata?: unknown }) {
  return prisma.proctoringSnapshot.create({
    data: {
      sessionId,
      imageUrl: input.imageUrl,
      type: input.type ?? 'screen',
      metadata: input.metadata as any,
    },
  });
}

export async function listActiveSessions() {
  const sessions = await prisma.proctoringSession.findMany({
    where: { status: 'ACTIVE' },
    include: {
      student: { select: { id: true, fullName: true, username: true, email: true } },
      test: { select: { id: true, title: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { events: true, snapshots: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
  return sessions.map((s) => ({
    ...s,
    eventCount: s._count.events,
    snapshotCount: s._count.snapshots,
    lastEvent: s.events[0] ?? null,
    _count: undefined,
    events: undefined,
  }));
}

export async function getAllSessions(query: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.proctoringSession.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: { select: { id: true, fullName: true, username: true, email: true } },
        test: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.proctoringSession.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getSessionDetail(id: string) {
  const session = await prisma.proctoringSession.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, fullName: true, username: true, email: true } },
      test: { select: { id: true, title: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 200 },
      snapshots: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!session) throw new AppError(404, 'Proctoring session not found');
  return session;
}

export async function alertStudent(sessionId: string, message: string) {
  const session = await prisma.proctoringSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Proctoring session not found');

  // Create notification for the student
  await prisma.notification.create({
    data: {
      userId: session.studentId,
      type: 'SYSTEM',
      title: 'Proctoring Alert',
      message,
    },
  });

  await logProctoringEvent(sessionId, {
    type: 'ALERT_SENT',
    severity: 'MEDIUM',
    message,
  });

  return { sent: true };
}

// Compute suspicion score across all sessions
export async function computeGlobalSuspicion() {
  const sessions = await prisma.proctoringSession.findMany({
    where: { status: 'ACTIVE' },
    include: { events: true },
  });

  for (const session of sessions) {
    const severityWeight = { HIGH: 10, MEDIUM: 5, LOW: 2 };
    const score = session.events.reduce(
      (sum, e) => sum + (severityWeight[e.severity as keyof typeof severityWeight] ?? 2),
      0,
    );
    if (score !== session.suspicionScore) {
      await prisma.proctoringSession.update({
        where: { id: session.id },
        data: { suspicionScore: Math.min(100, score) },
      });
    }
  }
  return { updated: sessions.length };
}