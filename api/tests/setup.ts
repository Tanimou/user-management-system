// Test setup file
import { afterAll, beforeAll } from 'vitest';

// Mock environment variables for testing
process.env.DATABASE_URL = "postgresql://test_user:test_password@localhost:5432/user_management_test";
process.env.DIRECT_URL = "postgresql://test_user:test_password@localhost:5432/user_management_test";
process.env.JWT_ACCESS_SECRET = "test-jwt-secret-for-testing";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-testing";
process.env.JWT_ACCESS_TTL_SECONDS = "900";
process.env.JWT_REFRESH_TTL_SECONDS = "604800";
process.env.FRONTEND_ORIGIN = "http://localhost:3000";
process.env.NODE_ENV = "test";

beforeAll(() => {
  // Any global test setup can go here
});

afterAll(() => {
  // Any global test cleanup can go here
});