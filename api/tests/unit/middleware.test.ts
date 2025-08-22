import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelResponse } from '@vercel/node';
import {
  authenticateRequest,
  authorizeRoles,
  requireAuthAndRoles,
  requireAdmin,
  requireUser,
  type AuthenticatedRequest,
  type JWTPayload
} from '../../lib/middleware/auth';

// Mock the auth utilities
vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth');
  return {
    ...actual,
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
  };
});

import { requireAuth, requireRole } from '../../lib/auth';

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
    vi.clearAllMocks();
  });

  describe('authenticateRequest', () => {
    it('should return true for valid authentication', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      
      const result = await authenticateRequest(req, res);
      
      expect(result).toBe(true);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
    });

    it('should return false for invalid authentication', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(false);
      
      const result = await authenticateRequest(req, res);
      
      expect(result).toBe(false);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
    });
  });

  describe('authorizeRoles', () => {
    it('should return true when user has required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user', 'admin']
      };
      
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = authorizeRoles(user, ['admin']);
      
      expect(result).toBe(true);
      expect(requireRole).toHaveBeenCalledWith(user, ['admin']);
    });

    it('should return false when user lacks required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user']
      };
      
      vi.mocked(requireRole).mockReturnValue(false);
      
      const result = authorizeRoles(user, ['admin']);
      
      expect(result).toBe(false);
      expect(requireRole).toHaveBeenCalledWith(user, ['admin']);
    });

    it('should handle undefined user', () => {
      vi.mocked(requireRole).mockReturnValue(false);
      
      const result = authorizeRoles(undefined, ['user']);
      
      expect(result).toBe(false);
      expect(requireRole).toHaveBeenCalledWith(undefined, ['user']);
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
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(true);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['admin']);
    });

    it('should return false if authentication fails', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(false);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(false);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
      expect(requireRole).not.toHaveBeenCalled();
    });

    it('should return false if authorization fails', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(false);
      
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
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res);
      
      expect(result).toBe(true);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['user']);
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
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireAdmin(req, res);
      
      expect(result).toBe(true);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['admin']);
    });

    it('should return false for non-admin users', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(false);
      
      const result = await requireAdmin(req, res);
      
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions. Required roles: admin',
      });
    });

    it('should return false for unauthenticated requests', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(false);
      
      const result = await requireAdmin(req, res);
      
      expect(result).toBe(false);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
      expect(requireRole).not.toHaveBeenCalled();
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
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireUser(req, res);
      
      expect(result).toBe(true);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['user', 'admin']);
    });

    it('should return true for admin users', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'admin@example.com',
        roles: ['user', 'admin']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireUser(req, res);
      
      expect(result).toBe(true);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['user', 'admin']);
    });

    it('should return false for unauthenticated requests', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(false);
      
      const result = await requireUser(req, res);
      
      expect(result).toBe(false);
      expect(requireAuth).toHaveBeenCalledWith(req, res);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockRejectedValue(new Error('Authentication error'));
      
      await expect(requireAuthAndRoles(req, res, ['user'])).rejects.toThrow('Authentication error');
    });

    it('should provide clear error messages for insufficient permissions', async () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user']
      };
      const req = createMockRequest(user);
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(false);
      
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
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res, ['admin', 'moderator']);
      
      expect(result).toBe(true);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['admin', 'moderator']);
    });

    it('should handle complex role hierarchies', async () => {
      const superAdminUser: JWTPayload = {
        userId: 1,
        email: 'superadmin@example.com',
        roles: ['user', 'admin', 'superadmin']
      };
      const req = createMockRequest(superAdminUser);
      const res = createMockResponse();
      
      vi.mocked(requireAuth).mockResolvedValue(true);
      vi.mocked(requireRole).mockReturnValue(true);
      
      const result = await requireAuthAndRoles(req, res, ['admin']);
      
      expect(result).toBe(true);
      expect(requireRole).toHaveBeenCalledWith(req.user, ['admin']);
    });
  });
});