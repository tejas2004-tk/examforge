import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The suite runs without a database: Prisma is mocked in every test that
    // reaches it, and these values only have to satisfy the env schema at import.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://examforge:examforge@localhost:5432/examforge_test',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
      FRONTEND_URL: 'http://localhost:5173',
    },
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
