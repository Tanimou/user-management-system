import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelResponse } from '@vercel/node';

// Create isolated mocks for each test run
const requireAuthMock = vi.fn();
const requireRoleMock = vi.fn();

// Mock the auth utilities with isolated functions
vi.mock('../../lib/auth', () => ({
  requireAuth: requireAuthMock,
  requireRole: requireRoleMock,
}));

// Import after mocking to ensure mock is applied
const { 
  authenticateRequest,
  authorizeRoles,
  requireAuthAndRoles,
  requireAdmin,
  requireUser
} = await import('../../lib/middleware/auth');

import type { AuthenticatedRequest, JWTPayload } from '../../lib/middleware/auth';

function createMockRequest(user?: JWTPayload, method: string = 'GET'): AuthenticatedRequest {
  return {
    method,
    headers: {},
    query: {},
    body: {},
    cookies: {},
    user,
  } as AuthenticatedRequest;
}

function createMockResponse(): VercelResponse {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as any;
}

describe('Authentication Middleware', () => {
  beforeEach(() => {
    // Clear all mocks and reset implementation to ensure clean state per test
    vi.clearAllMocks();
    vi.resetAllMocks();
    requireAuthMock.mockReset();
    requireRoleMock.mockReset();
  });

  describe('authenticateRequest', () => {
    it('should return true for valid authentication', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      
      const result = await authenticateRequest(req, res);
      
      expect(result).toBe(true);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
    });

    it('should return false for invalid authentication', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(false);
      
      const result = await authenticateRequest(req, res);
      
      expect(result).toBe(false);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
    });
  });

  describe('authorizeRoles', () => {
    it('should return true when user has required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user', 'admin']
      };
      
      requireRoleMock.mockReturnValue(true);
      
      const result = authorizeRoles(user, ['admin']);
      
      expect(result).toBe(true);
      expect(requireRoleMock).toHaveBeenCalledWith(user, ['admin']);
    });

    it('should return false when user lacks required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user']
      };
      
      requireRoleMock.mockReturnValue(false);
      
      const result = authorizeRoles(user, ['admin']);
      
      expect(result).toBe(false);
      expect(requireRoleMock).toHaveBeenCalledWith(user, ['admin']);
    });

    it('should handle undefined user', () => {
      requireRoleMock.mockReturnValue(false);
      
      const result = authorizeRoles(undefined, ['user']);
      
      expect(result).toBe(false);
      expect(requireRoleMock).toHaveBeenCalledWith(undefined, ['user']);
    });
  });

  describe('requireAuthAndRoles', () => {
    it('should return true for authenticated user with correct roles', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['admin']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(true);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['admin']);
    });

    it('should return false if authentication fails', async () => {
      // Ensure fresh mock state for this test
      vi.clearAllMocks();
      vi.resetAllMocks();
      requireAuthMock.mockReset();
      requireRoleMock.mockReset();
      
      const req = createMockRequest();
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(false);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(false);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
      expect(requireRoleMock).not.toHaveBeenCalled();
    });

    it('should return false if authorization fails', async () => {
      // Ensure fresh mock state for this test
      vi.clearAllMocks();
      vi.resetAllMocks();
      requireAuthMock.mockReset();
      requireRoleMock.mockReset();
      
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(false);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions. Required roles: admin',
      });
    });

    it('should use default roles when none specified', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res);
      
      expect(result).toBe(true);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['user']);
    });
  });

  describe('requireAdmin', () => {
    it('should return true for admin users', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'admin@example.com',
        roles: ['user', 'admin']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireAdmin(req, res);
      
      expect(result).toBe(true);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['admin']);
    });

    it('should return false for non-admin users', async () => {
      // Ensure fresh mock state for this test
      vi.clearAllMocks();
      vi.resetAllMocks();
      requireAuthMock.mockReset();
      requireRoleMock.mockReset();
      
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(false);
      
      const result = await requireAdmin(req, res);
      
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions. Required roles: admin',
      });
    });

    it('should return false for unauthenticated requests', async () => {
      // Ensure fresh mock state for this test
      vi.clearAllMocks();
      vi.resetAllMocks();
      requireAuthMock.mockReset();
      requireRoleMock.mockReset();
      
      const req = createMockRequest();
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(false);
      
      const result = await requireAdmin(req, res);
      
      expect(result).toBe(false);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
      expect(requireRoleMock).not.toHaveBeenCalled();
    });
  });

  describe('requireUser', () => {
    it('should return true for regular users', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireUser(req, res);
      
      expect(result).toBe(true);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['user', 'admin']);
    });

    it('should return true for admin users', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'admin@example.com',
        roles: ['user', 'admin']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireUser(req, res);
      
      expect(result).toBe(true);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['user', 'admin']);
    });

    it('should return false for unauthenticated requests', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(false);
      
      const result = await requireUser(req, res);
      
      expect(result).toBe(false);
      expect(requireAuthMock).toHaveBeenCalledWith(req, res);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      requireAuthMock.mockRejectedValue(new Error('Authentication error'));
      
      await expect(requireAuthAndRoles(req, res, ['user'])).rejects.toThrow('Authentication error');
    });

    it('should provide clear error messages for insufficient permissions', async () => {
      // Ensure fresh mock state for this test
      vi.clearAllMocks();
      vi.resetAllMocks();
      requireAuthMock.mockReset();
      requireRoleMock.mockReset();
      
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(false);
      
      await requireAuthAndRoles(req, res, ['admin', 'moderator']);
      
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions. Required roles: admin, moderator',
      });
    });
  });

  describe('Multiple Role Scenarios', () => {
    it('should handle OR logic for multiple allowed roles', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'moderator@example.com',
        roles: ['user', 'moderator']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res, ['admin', 'moderator']);
      
      expect(result).toBe(true);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['admin', 'moderator']);
    });

    it('should handle complex role hierarchies', async () => {
      const superAdminUser: JWTPayload = {
        userId: 1,
        email: 'superadmin@example.com',
        roles: ['user', 'admin', 'superadmin']
      };
      const req = createMockRequest(superAdminUser);
      const res = createMockResponse();
      
      requireAuthMock.mockResolvedValue(true);
      requireRoleMock.mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(true);
      expect(requireRoleMock).toHaveBeenCalledWith(req.user, ['admin']);
    });
  });
});