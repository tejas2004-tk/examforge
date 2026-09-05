import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createModuleSchema,
  updateModuleSchema,
  createLessonSchema,
  updateLessonSchema,
  createResourceSchema,
  createAnnouncementSchema,
  rateCourseSchema,
  createDiscussionSchema,
} from '../schemas/lms.schema.js';
import * as lmsService from '../services/lms.service.js';

export const createModule = asyncHandler(async (req: Request, res: Response) => {
  const input = createModuleSchema.parse(req.body);
  const mod = await lmsService.createModule(req.params.courseId, input);
  res.status(201).json({ success: true, data: { module: mod } });
});

export const listModules = asyncHandler(async (req: Request, res: Response) => {
  const modules = await lmsService.listModules(req.params.courseId);
  res.json({ success: true, data: { modules } });
});

export const getModule = asyncHandler(async (req: Request, res: Response) => {
  const mod = await lmsService.getModule(req.params.id);
  res.json({ success: true, data: { module: mod } });
});

export const updateModule = asyncHandler(async (req: Request, res: Response) => {
  const input = updateModuleSchema.parse(req.body);
  const mod = await lmsService.updateModule(req.params.id, input);
  res.json({ success: true, data: { module: mod } });
});

export const deleteModule = asyncHandler(async (req: Request, res: Response) => {
  await lmsService.deleteModule(req.params.id);
  res.json({ success: true, data: null });
});

export const createLesson = asyncHandler(async (req: Request, res: Response) => {
  const input = createLessonSchema.parse(req.body);
  const lesson = await lmsService.createLesson(req.params.moduleId, input);
  res.status(201).json({ success: true, data: { lesson } });
});

export const getLesson = asyncHandler(async (req: Request, res: Response) => {
  const lesson = await lmsService.getLesson(req.params.id);
  res.json({ success: true, data: { lesson } });
});

export const updateLesson = asyncHandler(async (req: Request, res: Response) => {
  const input = updateLessonSchema.parse(req.body);
  const lesson = await lmsService.updateLesson(req.params.id, input);
  res.json({ success: true, data: { lesson } });
});

export const deleteLesson = asyncHandler(async (req: Request, res: Response) => {
  await lmsService.deleteLesson(req.params.id);
  res.json({ success: true, data: null });
});

export const addResource = asyncHandler(async (req: Request, res: Response) => {
  const input = createResourceSchema.parse(req.body);
  const resource = await lmsService.addResource(req.params.lessonId, input);
  res.status(201).json({ success: true, data: { resource } });
});

export const deleteResource = asyncHandler(async (req: Request, res: Response) => {
  await lmsService.deleteResource(req.params.id);
  res.json({ success: true, data: null });
});

export const enrollStudent = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await lmsService.enrollStudent(req.user!.id, req.params.courseId);
  res.json({ success: true, data: { enrollment } });
});

export const getEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const enrollments = await lmsService.getEnrollments(req.params.courseId);
  res.json({ success: true, data: { enrollments } });
});

export const getMyEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const enrollments = await lmsService.getMyEnrollments(req.user!.id);
  res.json({ success: true, data: { enrollments } });
});

export const markLessonComplete = asyncHandler(async (req: Request, res: Response) => {
  const progress = await lmsService.markLessonComplete(req.user!.id, req.params.lessonId);
  res.json({ success: true, data: { progress } });
});

export const getCourseProgress = asyncHandler(async (req: Request, res: Response) => {
  const progress = await lmsService.getCourseProgress(req.user!.id, req.params.courseId);
  res.json({ success: true, data: { progress } });
});

export const getLessonProgress = asyncHandler(async (req: Request, res: Response) => {
  const progress = await lmsService.getLessonProgress(req.user!.id, req.params.courseId);
  res.json({ success: true, data: { progress } });
});

// --- Phase 8 additions ---

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const input = createAnnouncementSchema.parse(req.body);
  const announcement = await lmsService.createAnnouncement(req.params.courseId, req.user!.id, input);
  res.status(201).json({ success: true, data: { announcement } });
});

export const listAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const announcements = await lmsService.listAnnouncements(req.params.courseId);
  res.json({ success: true, data: { announcements } });
});

export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  await lmsService.deleteAnnouncement(req.params.id);
  res.json({ success: true, data: null });
});

export const rateCourse = asyncHandler(async (req: Request, res: Response) => {
  const input = rateCourseSchema.parse(req.body);
  const rating = await lmsService.rateCourse(req.user!.id, req.params.courseId, input);
  res.json({ success: true, data: { rating } });
});

export const listRatings = asyncHandler(async (req: Request, res: Response) => {
  const result = await lmsService.listRatings(req.params.courseId);
  res.json({ success: true, data: result });
});

export const getRatingSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await lmsService.getRatingSummary(req.params.courseId);
  res.json({ success: true, data: result });
});

export const getRecentlyViewed = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const items = await lmsService.getRecentlyViewed(req.user!.id, limit);
  res.json({ success: true, data: { items } });
});

export const trackRecentlyViewed = asyncHandler(async (req: Request, res: Response) => {
  const { lessonId, courseId } = req.body;
  const item = await lmsService.trackRecentlyViewed(req.user!.id, lessonId, courseId);
  res.json({ success: true, data: { item } });
});

export const createDiscussion = asyncHandler(async (req: Request, res: Response) => {
  const input = createDiscussionSchema.parse(req.body);
  const discussion = await lmsService.createDiscussion(req.params.courseId, req.user!.id, input.content, input.parentId);
  res.status(201).json({ success: true, data: { discussion } });
});

export const listDiscussions = asyncHandler(async (req: Request, res: Response) => {
  const discussions = await lmsService.listDiscussions(req.params.courseId);
  res.json({ success: true, data: { discussions } });
});

export const deleteDiscussion = asyncHandler(async (req: Request, res: Response) => {
  await lmsService.deleteDiscussion(req.params.id);
  res.json({ success: true, data: null });
});