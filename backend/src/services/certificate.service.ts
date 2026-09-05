import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import crypto from 'crypto';

function generateCredentialId(): string {
  return `CERT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function issueCertificate(userId: string, data: {
  courseId?: string;
  attemptId?: string;
  title: string;
  description?: string;
  expiresAt?: string;
}) {
  const existing = await prisma.certificate.findFirst({
    where: {
      userId,
      courseId: data.courseId ?? null,
      attemptId: data.attemptId ?? null,
    },
  });
  if (existing) throw new AppError(409, 'Certificate already issued');

  const credentialId = generateCredentialId();
  const verifyUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/verify/${credentialId}`;

  return prisma.certificate.create({
    data: {
      userId,
      courseId: data.courseId,
      attemptId: data.attemptId,
      title: data.title,
      description: data.description,
      credentialId,
      qrData: verifyUrl,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
    include: { user: { select: { fullName: true, email: true } }, course: true },
  });
}

export async function getMyCertificates(userId: string) {
  return prisma.certificate.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { course: { select: { id: true, name: true, code: true } } },
    orderBy: { issuedAt: 'desc' },
  });
}

export async function verifyCertificate(credentialId: string) {
  const cert = await prisma.certificate.findUnique({
    where: { credentialId },
    include: { user: { select: { fullName: true, email: true } }, course: { select: { name: true, code: true } } },
  });
  if (!cert) throw new AppError(404, 'Certificate not found');
  if (cert.status !== 'ACTIVE') throw new AppError(410, 'Certificate is no longer active');
  if (cert.expiresAt && cert.expiresAt < new Date()) throw new AppError(410, 'Certificate has expired');

  return {
    valid: true,
    credentialId: cert.credentialId,
    title: cert.title,
    description: cert.description,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    recipient: cert.user.fullName,
    course: cert.course?.name,
  };
}

export async function revokeCertificate(id: string) {
  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert) throw new AppError(404, 'Certificate not found');
  return prisma.certificate.update({ where: { id }, data: { status: 'REVOKED' } });
}

export async function listAllCertificates(userId?: string) {
  const where = userId ? { userId } : {};
  return prisma.certificate.findMany({
    where,
    include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { name: true } } },
    orderBy: { issuedAt: 'desc' },
    take: 100,
  });
}
