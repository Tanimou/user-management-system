import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    env: {
      DATABASE_URL: "postgresql://test_user:test_password@localhost:5432/user_management_test",
      JWT_ACCESS_SECRET: "test-jwt-secret-for-testing",
      JWT_REFRESH_SECRET: "test-refresh-secret-for-testing", 
      JWT_ACCESS_TTL_SECONDS: "900",
      JWT_REFRESH_TTL_SECONDS: "604800",
      FRONTEND_ORIGIN: "http://localhost:3000",
      NODE_ENV: "test"
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        'coverage/**',
        'vitest.config.ts'
      ]
    }
  }
});