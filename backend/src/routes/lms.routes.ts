import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createModule,
  listModules,
  getModule,
  updateModule,
  deleteModule,
  createLesson,
  getLesson,
  updateLesson,
  deleteLesson,
  addResource,
  deleteResource,
  enrollStudent,
  getEnrollments,
  getMyEnrollments,
  markLessonComplete,
  getCourseProgress,
  getLessonProgress,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
  rateCourse,
  listRatings,
  getRatingSummary,
  getRecentlyViewed,
  trackRecentlyViewed,
  createDiscussion,
  listDiscussions,
  deleteDiscussion,
} from '../controllers/lms.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const lmsRouter = Router();

lmsRouter.use(requireAuth);

// Course enrollment
lmsRouter.post('/courses/:courseId/enroll', enrollStudent);
lmsRouter.get('/courses/:courseId/enrollments', staffOnly, getEnrollments);
lmsRouter.get('/courses/:courseId/progress', getCourseProgress);
lmsRouter.get('/courses/:courseId/lesson-progress', getLessonProgress);
lmsRouter.get('/my-courses', getMyEnrollments);

// Modules
lmsRouter.get('/courses/:courseId/modules', listModules);
lmsRouter.post('/courses/:courseId/modules', staffOnly, auditLog('CREATE', 'Module'), createModule);
lmsRouter.get('/modules/:id', getModule);
lmsRouter.put('/modules/:id', staffOnly, auditLog('UPDATE', 'Module'), updateModule);
lmsRouter.delete('/modules/:id', staffOnly, auditLog('DELETE', 'Module'), deleteModule);

// Lessons
lmsRouter.post('/modules/:moduleId/lessons', staffOnly, auditLog('CREATE', 'Lesson'), createLesson);
lmsRouter.get('/lessons/:id', getLesson);
lmsRouter.put('/lessons/:id', staffOnly, auditLog('UPDATE', 'Lesson'), updateLesson);
lmsRouter.delete('/lessons/:id', staffOnly, auditLog('DELETE', 'Lesson'), deleteLesson);
lmsRouter.post('/lessons/:lessonId/complete', markLessonComplete);

// Resources
lmsRouter.post('/lessons/:lessonId/resources', staffOnly, auditLog('CREATE', 'Resource'), addResource);
lmsRouter.delete('/resources/:id', staffOnly, auditLog('DELETE', 'Resource'), deleteResource);

// --- Phase 8: Announcements, Ratings, Recently Viewed, Discussions ---
lmsRouter.get('/courses/:courseId/announcements', listAnnouncements);
lmsRouter.post('/courses/:courseId/announcements', staffOnly, auditLog('CREATE', 'Announcement'), createAnnouncement);
lmsRouter.delete('/announcements/:id', staffOnly, auditLog('DELETE', 'Announcement'), deleteAnnouncement);

lmsRouter.post('/courses/:courseId/rate', rateCourse);
lmsRouter.get('/courses/:courseId/ratings', listRatings);
lmsRouter.get('/courses/:courseId/rating-summary', getRatingSummary);

lmsRouter.get('/recently-viewed', getRecentlyViewed);
lmsRouter.post('/recently-viewed', trackRecentlyViewed);

lmsRouter.get('/courses/:courseId/discussions', listDiscussions);
lmsRouter.post('/courses/:courseId/discussions', createDiscussion);
lmsRouter.delete('/discussions/:id', deleteDiscussion);