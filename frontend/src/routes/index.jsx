import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../pages/auth/RegisterPage.jsx';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage.jsx';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { NotificationsPage } from '../pages/NotificationsPage.jsx';
import { CoursesPage } from '../pages/CoursesPage.jsx';
import { QuestionsPage } from '../pages/QuestionsPage.jsx';
import { QuestionBanksPage } from '../pages/QuestionBanksPage.jsx';
import { TestsPage } from '../pages/TestsPage.jsx';
import { TestDetailPage } from '../pages/TestDetailPage.jsx';
import { TeacherResults } from '../pages/TeacherResults.jsx';
import { TeacherResultDetail } from '../pages/TeacherResultDetail.jsx';
import { TeacherAssignmentsPage } from '../pages/AssignmentsPage.jsx';
import { StudentAssignmentsPage } from '../pages/AssignmentsPage.jsx';
import { ClassBatchesPage } from '../pages/ClassBatchesPage.jsx';
import { CourseCatalogPage } from '../pages/courses/CourseCatalogPage.jsx';
import { CourseDetailPage } from '../pages/courses/CourseDetailPage.jsx';
import { LessonPage } from '../pages/courses/LessonPage.jsx';
import { MyCoursesPage } from '../pages/courses/MyCoursesPage.jsx';
import { UsersPage } from '../pages/UsersPage.jsx';
import { StudentDashboard } from '../pages/student/StudentDashboard.jsx';
import { MyTests } from '../pages/student/MyTests.jsx';
import { ExamPage } from '../pages/student/ExamPage.jsx';
import { StudentResults } from '../pages/student/StudentResults.jsx';
import { StudentResultDetail } from '../pages/student/StudentResultDetail.jsx';
import { TeacherDashboard } from '../pages/teacher/TeacherDashboard.jsx';
import { AdminDashboard } from '../pages/admin/AdminDashboard.jsx';
import { AdminTestsPage } from '../pages/admin/AdminTestsPage.jsx';
import { AdminTestDetailPage } from '../pages/admin/AdminTestDetailPage.jsx';
import { AdminResultsPage } from '../pages/admin/AdminResultsPage.jsx';
import { AdminResultDetailPage } from '../pages/admin/AdminResultDetailPage.jsx';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage.jsx';

import { CodingProblemsPage } from '../pages/coding/CodingProblemsPage.jsx';
import { StudentCodingProblemsPage } from '../pages/coding/StudentCodingProblemsPage.jsx';
import { CodingProblemSolvePage } from '../pages/coding/CodingProblemSolvePage.jsx';
import { ProctoringDashboard } from '../pages/proctoring/ProctoringDashboard.jsx';
import { AiAssistantPage } from '../pages/ai/AiAssistantPage.jsx';
import { SearchResultsPage } from '../pages/search/SearchResultsPage.jsx';
import { OrganizationsPage } from '../pages/organizations/OrganizationsPage.jsx';
import { Spinner } from '../components/ui.jsx';

export const roleHome = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
  PROCTOR: '/proctoring',
};

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      <Route path="/" element={<HomePage />} />

      <Route path="/profile" element={<ProtectedRoute roles={['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR']}><ProfilePage /></ProtectedRoute>} />

      <Route element={<AppLayout />}>
        <Route path="/courses" element={<ProtectedRoute roles={['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR']}><CourseCatalogPage /></ProtectedRoute>} />
        <Route path="/courses/:courseId" element={<ProtectedRoute roles={['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR']}><CourseDetailPage /></ProtectedRoute>} />
        <Route path="/my-courses" element={<ProtectedRoute roles={['STUDENT']}><MyCoursesPage /></ProtectedRoute>} />
        <Route path="/lessons/:lessonId" element={<ProtectedRoute roles={['ADMIN', 'TEACHER', 'STUDENT']}><LessonPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute roles={['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR']}><SearchResultsPage /></ProtectedRoute>} />
        <Route path="/ai-assistant" element={<ProtectedRoute roles={['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR']}><AiAssistantPage /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
        <Route path="/admin/courses" element={<ProtectedRoute roles={['ADMIN']}><CoursesPage /></ProtectedRoute>} />
        <Route path="/admin/class-batches" element={<ProtectedRoute roles={['ADMIN']}><ClassBatchesPage /></ProtectedRoute>} />
        <Route path="/admin/organizations" element={<ProtectedRoute roles={['ADMIN']}><OrganizationsPage /></ProtectedRoute>} />
        <Route path="/admin/tests" element={<ProtectedRoute roles={['ADMIN']}><AdminTestsPage /></ProtectedRoute>} />
        <Route path="/admin/tests/:testId" element={<ProtectedRoute roles={['ADMIN']}><AdminTestDetailPage /></ProtectedRoute>} />
        <Route path="/admin/coding-problems" element={<ProtectedRoute roles={['ADMIN']}><CodingProblemsPage /></ProtectedRoute>} />
        <Route path="/admin/assignments" element={<ProtectedRoute roles={['ADMIN']}><TeacherAssignmentsPage /></ProtectedRoute>} />
        <Route path="/admin/results" element={<ProtectedRoute roles={['ADMIN']}><AdminResultsPage /></ProtectedRoute>} />
        <Route path="/admin/results/:attemptId" element={<ProtectedRoute roles={['ADMIN']}><AdminResultDetailPage /></ProtectedRoute>} />
        <Route path="/admin/proctoring" element={<ProtectedRoute roles={['ADMIN']}><ProctoringDashboard /></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute roles={['ADMIN']}><AdminAuditPage /></ProtectedRoute>} />
        <Route path="/admin/notifications" element={<ProtectedRoute roles={['ADMIN']}><NotificationsPage /></ProtectedRoute>} />

        <Route path="/teacher" element={<ProtectedRoute roles={['TEACHER']}><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/teacher/courses" element={<ProtectedRoute roles={['TEACHER']}><CoursesPage /></ProtectedRoute>} />
        <Route path="/teacher/class-batches" element={<ProtectedRoute roles={['TEACHER']}><ClassBatchesPage /></ProtectedRoute>} />
        <Route path="/teacher/questions" element={<ProtectedRoute roles={['TEACHER']}><QuestionsPage /></ProtectedRoute>} />
        <Route path="/teacher/banks" element={<ProtectedRoute roles={['TEACHER']}><QuestionBanksPage /></ProtectedRoute>} />
        <Route path="/teacher/tests" element={<ProtectedRoute roles={['TEACHER']}><TestsPage /></ProtectedRoute>} />
        <Route path="/teacher/tests/:testId" element={<ProtectedRoute roles={['TEACHER']}><TestDetailPage /></ProtectedRoute>} />
        <Route path="/teacher/coding-problems" element={<ProtectedRoute roles={['TEACHER']}><CodingProblemsPage /></ProtectedRoute>} />
        <Route path="/teacher/assignments" element={<ProtectedRoute roles={['TEACHER']}><TeacherAssignmentsPage /></ProtectedRoute>} />
        <Route path="/teacher/results" element={<ProtectedRoute roles={['TEACHER']}><TeacherResults /></ProtectedRoute>} />
        <Route path="/teacher/results/:attemptId" element={<ProtectedRoute roles={['TEACHER']}><TeacherResultDetail /></ProtectedRoute>} />
        <Route path="/teacher/proctoring" element={<ProtectedRoute roles={['TEACHER']}><ProctoringDashboard /></ProtectedRoute>} />
        <Route path="/teacher/notifications" element={<ProtectedRoute roles={['TEACHER']}><NotificationsPage /></ProtectedRoute>} />

        <Route path="/proctoring" element={<ProtectedRoute roles={['PROCTOR', 'ADMIN', 'TEACHER']}><ProctoringDashboard /></ProtectedRoute>} />

        <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/tests" element={<ProtectedRoute roles={['STUDENT']}><MyTests /></ProtectedRoute>} />
        <Route path="/student/tests/:testId/exam" element={<ProtectedRoute roles={['STUDENT']}><ExamPage /></ProtectedRoute>} />
        <Route path="/student/coding-problems" element={<ProtectedRoute roles={['STUDENT']}><StudentCodingProblemsPage /></ProtectedRoute>} />
        <Route path="/student/coding-problems/:problemId" element={<ProtectedRoute roles={['STUDENT']}><CodingProblemSolvePage /></ProtectedRoute>} />
        <Route path="/student/assignments" element={<ProtectedRoute roles={['STUDENT']}><StudentAssignmentsPage /></ProtectedRoute>} />
        <Route path="/student/results" element={<ProtectedRoute roles={['STUDENT']}><StudentResults /></ProtectedRoute>} />
        <Route path="/student/results/:attemptId" element={<ProtectedRoute roles={['STUDENT']}><StudentResultDetail /></ProtectedRoute>} />
        <Route path="/student/notifications" element={<ProtectedRoute roles={['STUDENT']}><NotificationsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!hasHydrated) return <Spinner label="Restoring your session…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to={roleHome[user?.role] ?? '/'} replace />;
  }
  return children;
}