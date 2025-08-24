import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser } from './utils/mocks';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  },
  USER_SELECT_FIELDS: {
    id: true,
    name: true,
    email: true,
    roles: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    avatarUrl: true,
  },
  USER_AUTH_SELECT_FIELDS: {
    id: true,
    name: true,
    email: true,
    password: true,
    roles: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    avatarUrl: true,
  }
}));

// Mock auth functions
vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth');
  return {
    ...actual,
    setCORSHeaders: vi.fn(),
    setSecurityHeaders: vi.fn(),
    verifyPassword: vi.fn(),
    signAccessToken: vi.fn().mockReturnValue('mock-access-token'),
    signRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
    setRefreshCookie: vi.fn(),
  };
});

// Mock rate limiter
vi.mock('../lib/rate-limiter', () => ({
  createAuthRateLimit: vi.fn(() => () => true), // Always allow by default
  recordAuthSuccess: vi.fn(),
  recordAuthFailure: vi.fn(),
}));

// Import after mocking
import handler from '../handlers/login';
import prisma from '../lib/prisma';
const { verifyPassword } = await import('../lib/auth');
const { createAuthRateLimit, recordAuthSuccess, recordAuthFailure } = await import('../lib/rate-limiter');

describe('Login API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset rate limiter to always allow by default
    vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
  });

  it('should return correct response format for successful login', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com', true, ['user']);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const req = createMockRequest('POST', {}, {
      body: {
        email: 'john@example.com',
        password: 'ValidPassword123!'
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'mock-access-token',
      user: expect.objectContaining({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        roles: ['user'],
        isActive: true
      })
    });
  });

  it('should return error with code for invalid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest('POST', {}, {
      body: {
        email: 'nonexistent@example.com',
        password: 'ValidPassword123!'
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS'
    });
    expect(recordAuthFailure).toHaveBeenCalled();
  });

  it('should validate password minimum length', async () => {
    const req = createMockRequest('POST', {}, {
      body: {
        email: 'user@example.com',
        password: 'short' // Less than 8 characters
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password does not meet policy requirements',
      details: expect.arrayContaining([
        'Password must be at least 8 characters long'
      ]),
      code: 'INVALID_PASSWORD_POLICY'
    });
  });

  it('should handle rate limiting with correct error format', async () => {
    // Mock rate limiter to return false (rate limit exceeded)
    vi.mocked(createAuthRateLimit).mockReturnValue(() => false);

    const req = createMockRequest('POST', {}, {
      body: {
        email: 'user@example.com',
        password: 'ValidPassword123!'
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    // The rate limiter middleware should handle the response
    // so the handler should return early without calling res.status or res.json
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should handle email case-insensitivity', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com', true, ['user']);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const req = createMockRequest('POST', {}, {
      body: {
        email: 'JOHN@EXAMPLE.COM', // Uppercase email
        password: 'ValidPassword123!'
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    // Should query with lowercase email
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'john@example.com' },
      select: expect.any(Object)
    });
  });

  it('should exclude password from user response', async () => {
    const mockUser = {
      ...createMockUser(1, 'John Doe', 'john@example.com', true, ['user']),
      password: 'hashed-password'
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const req = createMockRequest('POST', {}, {
      body: {
        email: 'john@example.com',
        password: 'ValidPassword123!'
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      token: 'mock-access-token',
      user: expect.not.objectContaining({
        password: expect.anything()
      })
    });
  });
});