// Test setup file for web workspace
import { vi } from 'vitest';

// Mock environment variables
Object.defineProperty(process, 'env', {
  value: {
    NODE_ENV: 'test',
    VITE_API_BASE_URL: 'http://localhost:3001/api'
  }
});

// Mock localStorage and sessionStorage
const createStorageMock = () => {
  const storage: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key]);
    }),
    key: vi.fn(),
    length: 0
  };
};

Object.defineProperty(window, 'localStorage', { value: createStorageMock() });
Object.defineProperty(window, 'sessionStorage', { value: createStorageMock() });

// Global test configuration
vi.mock('naive-ui', () => ({
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }),
  useDialog: () => ({
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  })
}));