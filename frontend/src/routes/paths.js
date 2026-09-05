/**
 * Route constants live apart from the route table so pages can import them
 * without pulling in every lazily-loaded page module through a cycle.
 */
export const ALL_ROLES = ['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR'];

export const roleHome = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
  PROCTOR: '/proctoring',
};

export const homeFor = (role) => roleHome[role] ?? '/';
