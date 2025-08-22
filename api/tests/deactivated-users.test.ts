import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../users/deactivated.ts';
import { requireAuth, requireRole } from '../lib/auth.js';
import prisma from '../lib/prisma.js';
import { createMockRequest, createMockResponse, createMockUser } from './utils/mocks.ts';

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

// Mock auth functions
vi.mock('../lib/auth.js', async () => {
  const actual = await vi.importActual('../lib/auth.js');
  return {
    ...actual,
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    setCORSHeaders: vi.fn(),
    setSecurityHeaders: vi.fn(),
  };
});

// Mock middleware components
vi.mock('../lib/middleware/enhanced-auth', async () => {
  const actual = await vi.importActual('../lib/middleware/enhanced-auth');
  return {
    ...actual,
    verifyToken: vi.fn(),
    withAuth: vi.fn((handler) => handler), // Pass through for testing
  };
});

vi.mock('../lib/middleware/validation', async () => {
  const actual = await vi.importActual('../lib/middleware/validation');
  return {
    ...actual,
    validateQuery: vi.fn((schema) => (handler) => async (req, res) => {
      // Process query parameters through validation
      const { error, value } = schema.validate(req.query);
      if (!error) {
        req.query = value;
      }
      return handler(req, res);
    }),
  };
});

vi.mock('../lib/middleware/index', async () => {
  const actual = await vi.importActual('../lib/middleware/index');
  return {
    ...actual,
    withCORS: vi.fn((handler) => handler), // Pass through for testing
    withErrorHandling: vi.fn((handler) => async (req, res) => {
      // Mock error handling middleware
      try {
        return await handler(req, res);
      } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }),
    withAuth: vi.fn((handler) => handler), // Pass through for testing
    withAdminRole: vi.fn((handler) => async (req, res) => {
      // Mock admin role check
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      return handler(req, res);
    }),
  };
});

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    }
  }
}));

import jwt from 'jsonwebtoken';
import { verifyToken } from '../lib/middleware/enhanced-auth';
import { getUsersSchema } from '../lib/schemas/user';

describe('Deactivated Users API - GET /api/users/deactivated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock JWT verification to return a valid payload
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 1,
      email: 'admin@example.com', 
      roles: ['admin']
    } as any);
    
    // Mock verifyToken to return successful auth
    vi.mocked(verifyToken).mockResolvedValue({
      authenticated: true,
      user: {
        id: 1,
        email: 'admin@example.com',
        roles: ['admin'],
        isActive: true
      }
    });
    
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(requireRole).mockReturnValue(true);
  });

  it('should return deactivated users for admin', async () => {
    const deactivatedUser1 = { ...createMockUser(1, 'Deactivated User 1', 'user1@example.com', false), deletedAt: '2025-01-01T00:00:00Z' };
    const deactivatedUser2 = { ...createMockUser(2, 'Deactivated User 2', 'user2@example.com', false), deletedAt: '2025-01-02T00:00:00Z' };
    
    vi.mocked(prisma.user.findMany).mockResolvedValue([deactivatedUser1, deactivatedUser2]);
    vi.mocked(prisma.user.count).mockResolvedValue(2);

    const req = createMockRequest('GET', {}, {
      user: { userId: 1, roles: ['admin'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: false,
        deletedAt: { not: null }
      },
      select: expect.objectContaining({
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        avatarUrl: true,
      }),
      orderBy: { deletedAt: 'desc' },
      skip: 0,
      take: 10,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [deactivatedUser1, deactivatedUser2],
      pagination: {
        page: 1,
        size: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it('should filter deactivated users by search', async () => {
    const deactivatedUser = { ...createMockUser(1, 'John Doe', 'john@example.com', false), deletedAt: '2025-01-01T00:00:00Z' };
    
    vi.mocked(prisma.user.findMany).mockResolvedValue([deactivatedUser]);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const req = createMockRequest('GET', { search: 'john' }, {
      user: { userId: 1, roles: ['admin'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: false,
        deletedAt: { not: null },
        OR: [
          { name: { contains: 'john', mode: 'insensitive' } },
          { email: { contains: 'john', mode: 'insensitive' } },
        ],
      },
      select: expect.any(Object),
      orderBy: { deletedAt: 'desc' },
      skip: 0,
      take: 10,
    });
    
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle pagination correctly', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest('GET', { page: '2', size: '5' }, {
      user: { userId: 1, roles: ['admin'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: false,
        deletedAt: { not: null }
      },
      select: expect.any(Object),
      orderBy: { deletedAt: 'desc' },
      skip: 5,
      take: 5,
    });
    
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle custom sorting', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest('GET', { sort: 'name', order: 'asc' }, {
      user: { userId: 1, roles: ['admin'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: false,
        deletedAt: { not: null }
      },
      select: expect.any(Object),
      orderBy: { name: 'asc' },
      skip: 0,
      take: 10,
    });
    
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should prevent non-admin access', async () => {
    vi.mocked(requireRole).mockReturnValue(false);

    const req = createMockRequest('GET', {}, {
      user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('Database error'));

    const req = createMockRequest('GET', {}, {
      user: { userId: 1, roles: ['admin'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('should reject non-GET methods', async () => {
    const req = createMockRequest('POST', {}, {
      user: { userId: 1, roles: ['admin'] }, headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });
});