import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['../tests/setup.ts'], // Updated path
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    env: {
      DATABASE_URL: 'postgresql://test_user:test_password@localhost:5432/user_management_test',
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-for-comprehensive-testing',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-comprehensive-testing',
      JWT_ACCESS_TTL_SECONDS: '900',
      JWT_REFRESH_TTL_SECONDS: '604800',
      FRONTEND_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'test',
    },
    include: [
      '../tests/**/*.test.ts', // Updated path
      '../tests/unit/**/*.test.ts', // Updated path
      '../tests/integration/**/*.test.ts', // Updated path
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        'coverage/**',
        'vitest.config.ts',
        '../tests/setup.ts', // Updated path
        '../tests/utils/**', // Updated path
        '../tests/factories/**', // Updated path
        '../tests/manual.js', // Updated path
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    sequence: {
      concurrent: false,
      shuffle: false,
    },
  },
});
