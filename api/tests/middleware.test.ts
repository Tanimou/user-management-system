import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, verifyToken, type AuthenticatedRequest } from '../lib/middleware/enhanced-auth.js';
import { withRoles, withAdminRole, withSelfOrAdmin, preventSelfDemotion } from '../lib/middleware/authorize.js';
import { withCORS } from '../lib/middleware/security.js';
import { withErrorHandling, AppError } from '../lib/middleware/errors.js';
import { validateBody, validateQuery } from '../lib/middleware/validation.js';
import Joi from 'joi';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn()
  }
}));

import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

describe('Enhanced Auth Middleware', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockHandler: vi.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
      query: {},
      method: 'GET'
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis()
    };
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token and return user data', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        roles: ['user'],
        isActive: true
      };

      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await verifyToken('valid-token');

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeUndefined();
    });

    it('should return error for user not found', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await verifyToken('valid-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('User not found or inactive');
    });

    it('should return error for expired token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = await verifyToken('expired-token');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token expired');
    });
  });

  describe('withAuth', () => {
    it('should authenticate valid request and call handler', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        roles: ['user'],
        isActive: true
      };

      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const wrappedHandler = withAuth(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser
        }),
        mockRes
      );
    });

    it('should return 401 for missing authorization header', async () => {
      const wrappedHandler = withAuth(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Missing or invalid authorization header'
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});

describe('Authorization Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockHandler: vi.Mock;

  beforeEach(() => {
    mockReq = {
      user: {
        id: 1,
        email: 'test@example.com',
        roles: ['user'],
        isActive: true
      },
      body: {},
      query: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  describe('withRoles', () => {
    it('should allow access with correct role', async () => {
      const wrappedHandler = withRoles(['user'])(mockHandler);
      await wrappedHandler(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access without correct role', async () => {
      const wrappedHandler = withRoles(['admin'])(mockHandler);
      await wrappedHandler(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        message: 'Required roles: admin',
        userRoles: ['user']
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('withAdminRole', () => {
    it('should allow access for admin user', async () => {
      mockReq.user!.roles = ['admin'];
      const wrappedHandler = withAdminRole(mockHandler);
      await wrappedHandler(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe('withSelfOrAdmin', () => {
    it('should allow user to access own resources', async () => {
      const getUserId = (req: AuthenticatedRequest) => req.user.id;
      const wrappedHandler = withSelfOrAdmin(getUserId)(mockHandler);
      
      await wrappedHandler(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should deny access to other users resources', async () => {
      const getUserId = () => 2; // Different user ID
      const wrappedHandler = withSelfOrAdmin(getUserId)(mockHandler);
      
      await wrappedHandler(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('preventSelfDemotion', () => {
    it('should prevent admin from removing own admin role', async () => {
      mockReq.user!.roles = ['admin'];
      mockReq.query = { id: '1' };
      mockReq.body = { roles: ['user'] };

      await preventSelfDemotion(mockHandler)(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Self-demotion prevented',
        message: 'Administrators cannot remove their own admin privileges'
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should prevent admin from deactivating themselves', async () => {
      mockReq.user!.roles = ['admin'];
      mockReq.query = { id: '1' };
      mockReq.body = { isActive: false };

      await preventSelfDemotion(mockHandler)(mockReq as AuthenticatedRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Self-deactivation prevented',
        message: 'Administrators cannot deactivate their own account'
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});

describe('Security Middleware', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockHandler: vi.Mock;

  beforeEach(() => {
    mockReq = { method: 'GET' };
    mockRes = {
      setHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis()
    };
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  describe('withCORS', () => {
    it('should set CORS and security headers', async () => {
      const wrappedHandler = withCORS(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should handle OPTIONS preflight requests', async () => {
      mockReq.method = 'OPTIONS';
      const wrappedHandler = withCORS(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.end).toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});

describe('Error Handling Middleware', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    vi.clearAllMocks();
  });

  describe('withErrorHandling', () => {
    it('should catch and handle errors', async () => {
      const errorHandler = () => {
        throw new Error('Test error');
      };

      const wrappedHandler = withErrorHandling(errorHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });

    it('should handle custom AppError', async () => {
      const errorHandler = () => {
        throw new AppError(400, 'Custom error');
      };

      const wrappedHandler = withErrorHandling(errorHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Custom error',
        message: 'Custom error'
      });
    });
  });
});

describe('Validation Middleware', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockHandler: vi.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  describe('validateBody', () => {
    const testSchema = Joi.object({
      name: Joi.string().min(2).required(),
      age: Joi.number().integer().min(0)
    });

    it('should validate and transform valid body', async () => {
      mockReq.body = { name: 'John', age: 30, extra: 'removed' };
      
      const wrappedHandler = validateBody(testSchema)(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockReq.body).toEqual({ name: 'John', age: 30 });
      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should return validation error for invalid body', async () => {
      mockReq.body = { name: 'A', age: -1 };
      
      const wrappedHandler = validateBody(testSchema)(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        message: 'Invalid input data',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: expect.stringContaining('at least 2 characters')
          })
        ])
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    const testSchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      size: Joi.number().integer().min(1).max(50).default(10)
    });

    it('should validate and transform valid query', async () => {
      mockReq.query = { page: '2', size: '20' };
      
      const wrappedHandler = validateQuery(testSchema)(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockReq.query).toEqual({ page: 2, size: 20 });
      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });
});