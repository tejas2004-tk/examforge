import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { storeFile, deleteFile, listFiles } from '../services/fileStorage.service.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

const UPLOAD_BASE = path.resolve('uploads');

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = path.join(UPLOAD_BASE, 'temp');
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'video/mp4', 'video/webm', 'video/ogg',
      'audio/mpeg', 'audio/wav',
      'application/zip', 'application/x-rar-compressed',
      'application/json',
      'text/html', 'text/css', 'text/javascript',
      'application/javascript',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new AppError(400, `File type ${file.mimetype} not allowed`));
    }
  },
});

export const fileUploadRouter = Router();
fileUploadRouter.use(requireAuth);

fileUploadRouter.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'No file uploaded');
  const subDir = (req.body.subDir as string) || 'resources';
  const file = await storeFile(req.user!.id, req.file, subDir);
  res.status(201).json({ success: true, data: { file } });
}));

fileUploadRouter.post('/upload/multiple', upload.array('files', 10), asyncHandler(async (req, res) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new AppError(400, 'No files uploaded');
  }
  const subDir = (req.body.subDir as string) || 'resources';
  const files = await Promise.all(req.files.map((f) => storeFile(req.user!.id, f, subDir)));
  res.status(201).json({ success: true, data: { files } });
}));

fileUploadRouter.get('/', asyncHandler(async (req, res) => {
  const files = await listFiles(req.user!.id);
  res.json({ success: true, data: { files } });
}));

fileUploadRouter.get('/:id', asyncHandler(async (req, res) => {
  const { getFile } = await import('../services/fileStorage.service.js');
  const file = await getFile(req.params.id);
  res.json({ success: true, data: { file } });
}));

fileUploadRouter.delete('/:id', asyncHandler(async (req, res) => {
  await deleteFile(req.params.id);
  res.json({ success: true, data: null });
}));

fileUploadRouter.get('/:id/download', asyncHandler(async (req, res) => {
  const file = await prisma.fileUpload.findUnique({ where: { id: req.params.id } });
  if (!file) throw new AppError(404, 'File not found');
  res.download(file.path, file.originalName);
}));
