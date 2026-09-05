import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

const UPLOAD_BASE = path.resolve('uploads');

export interface StoredFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageType: string;
  path: string;
  url: string | null;
  createdAt: Date;
}

function generateFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${hash}${ext}`;
}

export async function storeFile(
  userId: string,
  file: Express.Multer.File,
  subDir: string = 'resources',
): Promise<StoredFile> {
  const dir = path.join(UPLOAD_BASE, subDir);
  await fs.mkdir(dir, { recursive: true });

  const fileName = generateFileName(file.originalname);
  const filePath = path.join(dir, fileName);

  if (file.buffer) {
    await fs.writeFile(filePath, file.buffer);
  } else if (file.path) {
    await fs.copyFile(file.path, filePath);
  } else {
    throw new AppError(400, 'No file data provided');
  }

  const record = await prisma.fileUpload.create({
    data: {
      originalName: file.originalname,
      fileName,
      mimeType: file.mimetype,
      size: file.size,
      storageType: 'local',
      path: filePath,
      url: `/uploads/${subDir}/${fileName}`,
      uploadedById: userId,
    },
  });

  return record;
}

export async function getFile(id: string): Promise<StoredFile> {
  const record = await prisma.fileUpload.findUnique({ where: { id } });
  if (!record) throw new AppError(404, 'File not found');
  return record;
}

export async function deleteFile(id: string): Promise<void> {
  const record = await prisma.fileUpload.findUnique({ where: { id } });
  if (!record) throw new AppError(404, 'File not found');

  try {
    await fs.unlink(record.path);
  } catch {
    // File may already be deleted
  }

  await prisma.fileUpload.delete({ where: { id } });
}

export async function listFiles(userId?: string, subDir?: string) {
  const where: any = {};
  if (userId) where.uploadedById = userId;

  return prisma.fileUpload.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
