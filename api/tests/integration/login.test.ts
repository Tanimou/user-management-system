import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../utils/mocks';
import { UserFactory, MockResponseFactory } from '../factories/user.factory';

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth');
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

vi.mock('../../lib/rate-limiter', () => ({
  createAuthRateLimit: vi.fn(() => () => true),
  recordAuthSuccess: vi.fn(),
  recordAuthFailure: vi.fn(),
}));

import handler from '../../login';
import prisma from '../../lib/prisma';
import { 
  setCORSHeaders, 
  setSecurityHeaders, 
  verifyPassword, 
  signAccessToken,
  signRefreshToken,
  setRefreshCookie 
} from '../../lib/auth';
import { createAuthRateLimit, recordAuthSuccess, recordAuthFailure } from '../../lib/rate-limiter';

describe('Login API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: allow all requests (not rate limited)
    vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
  });

  describe('Successful Login Flow', () => {
    it('should complete full login flow for valid user', async () => {
      // Create test user
      const testUser = await UserFactory.createUser({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      });

      // Mock database response
      vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser as any);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      // Verify complete flow
      expect(setCORSHeaders).toHaveBeenCalledWith(res);
      expect(setSecurityHeaders).toHaveBeenCalledWith(res);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.any(Object),
      });
      expect(verifyPassword).toHaveBeenCalledWith(testUser.password, 'ValidPassword123!');
      expect(signAccessToken).toHaveBeenCalledWith({
        userId: testUser.id,
        email: testUser.email,
        roles: testUser.roles,
      });
      expect(signRefreshToken).toHaveBeenCalledWith({ userId: testUser.id });
      expect(setRefreshCookie).toHaveBeenCalledWith(res, 'mock-refresh-token');
      expect(recordAuthSuccess).toHaveBeenCalledWith('test@example.com');
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'mock-access-token',
        user: {
          id: testUser.id,
          name: testUser.name,
          email: testUser.email,
          roles: testUser.roles,
          isActive: testUser.isActive,
          avatarUrl: testUser.avatarUrl,
        },
      });
    });

    it('should handle admin user login', async () => {
      const adminUser = await UserFactory.createAdmin({
        email: 'admin@example.com',
        password: 'AdminPassword123!',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'admin@example.com',
          password: 'AdminPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            roles: expect.arrayContaining(['admin']),
          }),
        })
      );
    });
  });

  describe('Authentication Failures', () => {
    it('should handle non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'nonexistent@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      expect(recordAuthFailure).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('should handle incorrect password', async () => {
      const testUser = await UserFactory.createUser({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser as any);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'WrongPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      expect(recordAuthFailure).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle inactive user', async () => {
      const inactiveUser = await UserFactory.createInactiveUser({
        email: 'inactive@example.com',
        password: 'ValidPassword123!',
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUser as any);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'inactive@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
      expect(recordAuthFailure).toHaveBeenCalledWith('inactive@example.com');
    });
  });

  describe('Input Validation', () => {
    it('should validate required email field', async () => {
      const req = createMockRequest('POST', {}, {
        body: {
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        details: ['Email is required'],
        code: 'MISSING_FIELDS',
      });
    });

    it('should validate required password field', async () => {
      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        details: ['Password is required'],
        code: 'MISSING_FIELDS',
      });
    });

    it('should validate email format', async () => {
      const req = createMockRequest('POST', {}, {
        body: {
          email: 'invalid-email',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    });

    it('should validate password length', async () => {
      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'short',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Password does not meet policy requirements',
        details: expect.arrayContaining([
          'Password must be at least 8 characters long'
        ]),
        code: 'INVALID_PASSWORD_POLICY',
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit exceeded', async () => {
      // Mock rate limiter to deny request and set response
      vi.mocked(createAuthRateLimit).mockReturnValue((req, res) => {
        res.status(429).json({
          error: 'Too many login attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60
        });
        return false;
      });

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/rate limit|too many/i),
        })
      );
    });

    it('should track auth failures for rate limiting', async () => {
      const testUser = await UserFactory.createUser();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser as any);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'WrongPassword',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(recordAuthFailure).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('HTTP Methods', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(setCORSHeaders).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('should reject non-POST/OPTIONS requests', async () => {
      const req = createMockRequest('GET');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database connection failed'));

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should handle password verification errors', async () => {
      const testUser = await UserFactory.createUser();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser as any);
      vi.mocked(verifyPassword).mockRejectedValue(new Error('Hash verification failed'));

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should handle token generation errors', async () => {
      const testUser = await UserFactory.createUser();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser as any);
      vi.mocked(verifyPassword).mockResolvedValue(true);
      vi.mocked(signAccessToken).mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('Security Headers and CORS', () => {
    it('should set security headers on all responses', async () => {
      const req = createMockRequest('POST', {}, {
        body: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(setCORSHeaders).toHaveBeenCalledWith(res);
      expect(setSecurityHeaders).toHaveBeenCalledWith(res);
    });

    it('should handle malformed request body', async () => {
      const req = createMockRequest('POST', {}, {
        body: 'invalid-json',
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(setCORSHeaders).toHaveBeenCalledWith(res);
      expect(setSecurityHeaders).toHaveBeenCalledWith(res);
    });
  });
});