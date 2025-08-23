import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../utils/mocks';
import { UserFactory } from '../factories/user.factory';

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
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

vi.mock('../../lib/validation', () => ({
  validatePasswordPolicy: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}));

vi.mock('../../lib/rate-limiter', () => ({
  createAuthRateLimit: vi.fn().mockReturnValue(() => true),
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
import { validatePasswordPolicy } from '../../lib/validation';

describe('Login API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset all mocks to default state
    vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
    vi.mocked(validatePasswordPolicy).mockReturnValue({ isValid: true, errors: [] });
    vi.mocked(setCORSHeaders).mockImplementation(() => {});
    vi.mocked(setSecurityHeaders).mockImplementation(() => {});
    vi.mocked(signAccessToken).mockReturnValue('mock-access-token');
    vi.mocked(signRefreshToken).mockReturnValue('mock-refresh-token');
    vi.mocked(setRefreshCookie).mockImplementation(() => {});
    vi.mocked(recordAuthSuccess).mockImplementation(() => {});
    vi.mocked(recordAuthFailure).mockImplementation(() => {});
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
      expect(recordAuthSuccess).toHaveBeenCalledWith(req, 'test@example.com');
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        token: 'mock-access-token',
        user: {
          id: testUser.id,
          name: testUser.name,
          email: testUser.email,
          roles: testUser.roles,
          isActive: testUser.isActive,
          createdAt: testUser.createdAt,
          updatedAt: testUser.updatedAt,
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
          token: 'mock-access-token',
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
      expect(recordAuthFailure).toHaveBeenCalledWith(req, 'nonexistent@example.com');
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
      expect(recordAuthFailure).toHaveBeenCalledWith(req, 'test@example.com');
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
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      expect(recordAuthFailure).toHaveBeenCalledWith(req, 'inactive@example.com');
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
        error: 'Email and password are required',
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
        error: 'Email and password are required',
      });
    });

    it('should validate email format', async () => {
      // Mock user not found for invalid email format
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      
      const req = createMockRequest('POST', {}, {
        body: {
          email: 'invalid-email',
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
    });

    it('should validate password length', async () => {
      // Mock password policy validation to fail for short password
      vi.mocked(validatePasswordPolicy).mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters long']
      });
      
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
        details: ['Password must be at least 8 characters long'],
        code: 'INVALID_PASSWORD_POLICY',
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit exceeded', async () => {
      // Mock rate limiter to deny request
      const mockRateLimitMiddleware = vi.fn((req: any, res: any): boolean => {
        res.status(429).json({
          error: 'Too many login attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60
        });
        return false;
      });
      vi.mocked(createAuthRateLimit).mockReturnValue(mockRateLimitMiddleware);

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
      // Clear and reset all mocks to ensure clean state
      vi.clearAllMocks();
      vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
      vi.mocked(validatePasswordPolicy).mockReturnValue({ isValid: true, errors: [] });
      vi.mocked(setCORSHeaders).mockImplementation(() => {});
      vi.mocked(setSecurityHeaders).mockImplementation(() => {});
      vi.mocked(recordAuthFailure).mockImplementation(() => {});
      
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

      expect(recordAuthFailure).toHaveBeenCalledWith(req, 'test@example.com');
    });
  });

  describe('HTTP Methods', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(setCORSHeaders).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });

    it('should reject non-POST/OPTIONS requests', async () => {
      const req = createMockRequest('GET');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Method not allowed',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Clear and reset all mocks to ensure clean state
      vi.clearAllMocks();
      vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
      vi.mocked(validatePasswordPolicy).mockReturnValue({ isValid: true, errors: [] });
      vi.mocked(setCORSHeaders).mockImplementation(() => {});
      vi.mocked(setSecurityHeaders).mockImplementation(() => {});
      
      // Mock the database error
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
      });
    });

    it('should handle password verification errors', async () => {
      // Clear and reset all mocks to ensure clean state
      vi.clearAllMocks();
      vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
      vi.mocked(validatePasswordPolicy).mockReturnValue({ isValid: true, errors: [] });
      vi.mocked(setCORSHeaders).mockImplementation(() => {});
      vi.mocked(setSecurityHeaders).mockImplementation(() => {});
      
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
      });
    });

    it('should handle token generation errors', async () => {
      // Clear and reset all mocks to ensure clean state
      vi.clearAllMocks();
      vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
      vi.mocked(validatePasswordPolicy).mockReturnValue({ isValid: true, errors: [] });
      vi.mocked(setCORSHeaders).mockImplementation(() => {});
      vi.mocked(setSecurityHeaders).mockImplementation(() => {});
      
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