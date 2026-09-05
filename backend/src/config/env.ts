import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_PROVIDER: z.enum(['external', 'openai', 'gemini', 'ollama']).default('external'),
  OPENAI_API_KEY: z.string().optional().default(''),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_BUCKET: z.string().default('examforge'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('ExamForge <no-reply@examforge.dev>'),
  ENABLE_METRICS: z.string().default('false').transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;