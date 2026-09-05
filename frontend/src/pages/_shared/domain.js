/** Mirrors the Prisma enums in backend/prisma/schema.prisma. */

export const QUESTION_TYPES = [
  { value: 'SINGLE', label: 'Single choice', hint: 'One correct option' },
  { value: 'MULTIPLE', label: 'Multiple choice', hint: 'One or more correct options' },
  { value: 'TRUE_FALSE', label: 'True / false', hint: 'Two fixed options' },
  { value: 'FILL_BLANK', label: 'Fill in the blank', hint: 'Exact text match' },
  { value: 'MATCH', label: 'Match the pairs', hint: 'Left column to right column' },
  { value: 'CODING', label: 'Coding', hint: 'Graded manually or by test cases' },
  { value: 'SUBJECTIVE', label: 'Subjective', hint: 'Graded manually' },
];

export const OPTION_TYPES = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE'];
export const MANUAL_TYPES = ['SUBJECTIVE', 'CODING'];

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

export const BLOOM_LEVELS = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'];

export const EXAM_MODES = ['PRACTICE', 'MOCK_TEST', 'QUIZ', 'MIDTERM', 'FINAL', 'CERTIFICATION', 'CODING_TEST'];

export const TEST_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'];

export const ROLES = ['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR'];

export const CODING_LANGUAGES = [
  { value: 'python', label: 'Python', monaco: 'python' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'java', label: 'Java', monaco: 'java' },
];

const TITLES = {
  SINGLE: 'Single choice',
  MULTIPLE: 'Multiple choice',
  TRUE_FALSE: 'True / false',
  FILL_BLANK: 'Fill in the blank',
  MATCH: 'Match the pairs',
  CODING: 'Coding',
  SUBJECTIVE: 'Subjective',
};

export const questionTypeLabel = (type) => TITLES[type] ?? type;

/** Enum-ish strings arrive SCREAMING_CASE; render them as sentence case. */
export const humanise = (value) =>
  typeof value === 'string' && value
    ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
    : '';

export const difficultyTone = (difficulty) =>
  ({ EASY: 'positive', MEDIUM: 'info', HARD: 'caution', EXPERT: 'critical' })[difficulty] ?? 'neutral';

export const severityTone = (severity) =>
  ({ LOW: 'neutral', MEDIUM: 'caution', HIGH: 'critical' })[severity] ?? 'neutral';
