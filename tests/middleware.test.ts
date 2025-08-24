import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock prisma as default export
vi.mock('../lib/prisma', () => ({
  default: {
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

// Import after mocking
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { withAuth, verifyToken, type AuthenticatedRequest } from '../lib/middleware/enhanced-auth';

describe('Enhanced Auth Middleware', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let mockHandler: MockedFunction<any>;

  beforeEach(() => {
    // Clear all mocks first
    vi.clearAllMocks();
    
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
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token and return user data', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed_password',
        roles: ['user'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        avatarUrl: null,
      };

      // Mock jwt.verify to return payload
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
      // Mock prisma.user.findUnique to return user
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await verifyToken('valid-token');

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        roles: mockUser.roles,
        isActive: mockUser.isActive
      });
      expect(result.error).toBeUndefined();
    });

    it('should return error for user not found', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
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
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed_password',
        roles: ['user'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        avatarUrl: null,
      };

      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const wrappedHandler = withAuth(mockHandler);
      await wrappedHandler(mockReq as VercelRequest, mockRes as VercelResponse);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            id: mockUser.id,
            email: mockUser.email,
            roles: mockUser.roles,
            isActive: mockUser.isActive
          }
        }),
        mockRes
      );
    });

    it('should return 401 for missing authorization header', async () => {
      // Ensure no authorization header
      mockReq.headers = {};
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