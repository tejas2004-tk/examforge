import { z } from 'zod';

export const createModuleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
});

export const updateModuleSchema = createModuleSchema.partial();

export const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000).optional(),
  type: z.enum(['text', 'video', 'pdf', 'external']).default('text'),
  videoUrl: z.string().url().optional().nullable(),
  durationMin: z.coerce.number().int().min(0).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
});

export const updateLessonSchema = createLessonSchema.partial();

export const createResourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  url: z.string().url(),
  size: z.coerce.number().int().min(0).optional(),
});

// --- Phase 8 additions ---

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(10000),
  pinned: z.boolean().optional().default(false),
});

export const rateCourseSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

export const createDiscussionSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type RateCourseInput = z.infer<typeof rateCourseSchema>;
export type CreateDiscussionInput = z.infer<typeof createDiscussionSchema>;