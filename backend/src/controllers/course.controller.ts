import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createCourseSchema, updateCourseSchema } from '../schemas/course.schema.js';
import * as courseService from '../services/course.service.js';

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const input = createCourseSchema.parse(req.body);
  const course = await courseService.createCourse(input);
  res.status(201).json({ success: true, data: { course } });
});

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseService.listCourses(req.query);
  res.json({ success: true, data });
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.getCourse(req.params.id);
  res.json({ success: true, data: { course } });
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const input = updateCourseSchema.parse(req.body);
  const course = await courseService.updateCourse(req.params.id, input);
  res.json({ success: true, data: { course } });
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  await courseService.deleteCourse(req.params.id);
  res.json({ success: true, data: null });
});
