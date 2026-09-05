import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as orgService from '../services/organization.service.js';

const superAdminOnly = requireRole('ADMIN');
const staffOnly = requireRole('ADMIN', 'TEACHER');

export const organizationRouter = Router();

organizationRouter.use(requireAuth);

// Organizations
organizationRouter.get('/', superAdminOnly, asyncHandler(async (_req, res) => {
  const orgs = await orgService.listOrganizations();
  res.json({ success: true, data: { organizations: orgs } });
}));

organizationRouter.post('/', superAdminOnly, auditLog('CREATE', 'Organization'), asyncHandler(async (req, res) => {
  const org = await orgService.createOrganization(req.body);
  res.status(201).json({ success: true, data: { organization: org } });
}));

organizationRouter.get('/:id', staffOnly, asyncHandler(async (req, res) => {
  const org = await orgService.getOrganization(req.params.id);
  res.json({ success: true, data: { organization: org } });
}));

organizationRouter.put('/:id', superAdminOnly, auditLog('UPDATE', 'Organization'), asyncHandler(async (req, res) => {
  const org = await orgService.updateOrganization(req.params.id, req.body);
  res.json({ success: true, data: { organization: org } });
}));

organizationRouter.post('/:id/members', superAdminOnly, asyncHandler(async (req, res) => {
  const member = await orgService.addOrganizationMember(req.params.id, req.body.userId, req.body.role);
  res.status(201).json({ success: true, data: { member } });
}));

organizationRouter.delete('/:id/members/:userId', superAdminOnly, asyncHandler(async (req, res) => {
  await orgService.removeOrganizationMember(req.params.id, req.params.userId);
  res.json({ success: true, data: null });
}));

// Departments
organizationRouter.get('/:id/departments', staffOnly, asyncHandler(async (req, res) => {
  const depts = await orgService.listDepartments(req.params.id);
  res.json({ success: true, data: { departments: depts } });
}));

organizationRouter.post('/:id/departments', superAdminOnly, auditLog('CREATE', 'Department'), asyncHandler(async (req, res) => {
  const dept = await orgService.createDepartment(req.params.id, req.body);
  res.status(201).json({ success: true, data: { department: dept } });
}));

organizationRouter.put('/departments/:id', superAdminOnly, asyncHandler(async (req, res) => {
  const dept = await orgService.updateDepartment(req.params.id, req.body);
  res.json({ success: true, data: { department: dept } });
}));

organizationRouter.delete('/departments/:id', superAdminOnly, asyncHandler(async (req, res) => {
  await orgService.deleteDepartment(req.params.id);
  res.json({ success: true, data: null });
}));

// Academic Years
organizationRouter.get('/:id/academic-years', staffOnly, asyncHandler(async (req, res) => {
  const years = await orgService.listAcademicYears(req.params.id);
  res.json({ success: true, data: { academicYears: years } });
}));

organizationRouter.post('/:id/academic-years', superAdminOnly, asyncHandler(async (req, res) => {
  const year = await orgService.createAcademicYear(req.params.id, req.body);
  res.status(201).json({ success: true, data: { academicYear: year } });
}));

// Semesters
organizationRouter.get('/academic-years/:id/semesters', staffOnly, asyncHandler(async (req, res) => {
  const semesters = await orgService.listSemesters(req.params.id);
  res.json({ success: true, data: { semesters } });
}));

organizationRouter.post('/academic-years/:id/semesters', superAdminOnly, asyncHandler(async (req, res) => {
  const semester = await orgService.createSemester(req.params.id, req.body);
  res.status(201).json({ success: true, data: { semester } });
}));

// Batches (within department)
organizationRouter.get('/departments/:id/batches', staffOnly, asyncHandler(async (req, res) => {
  const batches = await orgService.listBatches(req.params.id);
  res.json({ success: true, data: { batches } });
}));

organizationRouter.post('/departments/:id/batches', superAdminOnly, asyncHandler(async (req, res) => {
  const batch = await orgService.createBatch(req.params.id, req.body);
  res.status(201).json({ success: true, data: { batch } });
}));

organizationRouter.post('/batches/:id/students', superAdminOnly, asyncHandler(async (req, res) => {
  const membership = await orgService.addStudentToBatch(req.params.id, req.body.studentId);
  res.status(201).json({ success: true, data: { membership } });
}));

organizationRouter.delete('/batches/:id/students/:studentId', superAdminOnly, asyncHandler(async (req, res) => {
  await orgService.removeStudentFromBatch(req.params.id, req.params.studentId);
  res.json({ success: true, data: null });
}));

organizationRouter.get('/batches/:id/students', staffOnly, asyncHandler(async (req, res) => {
  const students = await orgService.listBatchStudents(req.params.id);
  res.json({ success: true, data: { students } });
}));