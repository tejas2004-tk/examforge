import {
  Bell,
  BookOpen,
  Building2,
  ChartBar,
  ClipboardList,
  CodeXml,
  Eye,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

/**
 * Sidebar navigation, grouped by role.
 *
 * Previously this lived inline in AppLayout as raw SVG `d` path strings, which
 * made the file unreadable and let several entries drift: ADMIN and TEACHER
 * each rendered two items both labelled "Courses" (the shared catalog and their
 * own management page), and four unrelated entries shared the book glyph.
 * Labels are now distinct and every entry has its own icon.
 */

export const ROLE_LABEL = {
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PROCTOR: 'Proctor',
};

const catalog = { to: '/courses', label: 'Course catalog', icon: Library };
const aiAssistant = { to: '/ai-assistant', label: 'AI assistant', icon: Sparkles };

export const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    catalog,
    { to: '/admin/courses', label: 'Manage courses', icon: BookOpen },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/class-batches', label: 'Class batches', icon: GraduationCap },
    { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
    { to: '/admin/tests', label: 'Tests', icon: FileCheck },
    { to: '/admin/coding-problems', label: 'Coding problems', icon: CodeXml },
    { to: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/admin/results', label: 'Results', icon: ChartBar },
    { to: '/admin/proctoring', label: 'Proctoring', icon: Eye },
    aiAssistant,
    { to: '/admin/audit', label: 'Audit logs', icon: ScrollText },
  ],
  TEACHER: [
    { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
    catalog,
    { to: '/teacher/courses', label: 'My courses', icon: BookOpen },
    { to: '/teacher/class-batches', label: 'Class batches', icon: GraduationCap },
    { to: '/teacher/questions', label: 'Questions', icon: ClipboardList },
    { to: '/teacher/banks', label: 'Question banks', icon: Library },
    { to: '/teacher/tests', label: 'Tests', icon: FileCheck },
    { to: '/teacher/coding-problems', label: 'Coding problems', icon: CodeXml },
    { to: '/teacher/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/teacher/results', label: 'Results', icon: ChartBar },
    { to: '/teacher/proctoring', label: 'Proctoring', icon: Eye },
    aiAssistant,
  ],
  PROCTOR: [
    { to: '/proctoring', label: 'Active sessions', icon: Eye, end: true },
    catalog,
    { to: '/notifications', label: 'Notifications', icon: Bell },
    aiAssistant,
  ],
  STUDENT: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/my-courses', label: 'My courses', icon: BookOpen },
    { to: '/courses', label: 'Catalog', icon: Search },
    { to: '/student/tests', label: 'My tests', icon: FileCheck },
    { to: '/student/coding-problems', label: 'Coding problems', icon: CodeXml },
    { to: '/student/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/student/results', label: 'Results', icon: ChartBar },
    aiAssistant,
  ],
};

export const navForRole = (role) => NAV_BY_ROLE[role] ?? [];
