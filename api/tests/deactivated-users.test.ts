import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../users/deactivated.ts';
import { requireAuth, requireRole } from '../lib/auth.js';
import prisma from '../lib/prisma.js';
import { createMockRequest, createMockResponse, createMockUser } from './utils/mocks.ts';

// Mock dependencies
vi.mock('../lib/auth.js');
vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    }
  }
}));

describe('Deactivated Users API - GET /api/users/deactivated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(requireRole).mockReturnValue(true);
  });

  it('should return deactivated users for admin', async () => {
    const deactivatedUser1 = { ...createMockUser(1, 'Deactivated User 1', 'user1@example.com', false), deletedAt: '2025-01-01T00:00:00Z' };
    const deactivatedUser2 = { ...createMockUser(2, 'Deactivated User 2', 'user2@example.com', false), deletedAt: '2025-01-02T00:00:00Z' };
    
    vi.mocked(prisma.user.findMany).mockResolvedValue([deactivatedUser1, deactivatedUser2]);
    vi.mocked(prisma.user.count).mockResolvedValue(2);

    const req = createMockRequest('GET', {}, {
      user: { userId: 1, roles: ['admin'] }
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
      user: { userId: 1, roles: ['admin'] }
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
      user: { userId: 1, roles: ['admin'] }
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

    const req = createMockRequest('GET', { orderBy: 'name', order: 'asc' }, {
      user: { userId: 1, roles: ['admin'] }
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
      user: { userId: 1, roles: ['user'] }
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
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('should reject non-GET methods', async () => {
    const req = createMockRequest('POST', {}, {
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });
});