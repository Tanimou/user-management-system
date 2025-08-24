import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../lib/middleware/enhanced-auth.js';

// Mock prisma first - before any other imports
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock audit functions
vi.mock('../lib/audit-logger', () => ({
  logRoleChange: vi.fn(),
  logStatusChange: vi.fn(),
  logUserDeletion: vi.fn(),
}));

// Mock auth
vi.mock('../lib/auth', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  hashPassword: vi.fn(),
  setCORSHeaders: vi.fn(),
  setSecurityHeaders: vi.fn(),
}));

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

// Mock middleware - these should pass through and apply logic
vi.mock('../lib/middleware/index', () => ({
  withCORS: vi.fn((handler: any) => handler),
  withErrorHandling: vi.fn((handler: any) => handler), 
  withAuth: vi.fn((handler: any) => handler),
  withAdminRole: vi.fn((handler: any) => async (req: any, res: any) => {
    if (!req.user?.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }
    return handler(req, res);
  }),
  withSelfOrAdmin: vi.fn((getUserId: any) => (handler: any) => async (req: any, res: any) => {
    const userIdStr = getUserId(req);
    
    if (isNaN(parseInt(userIdStr))) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const targetUserId = parseInt(userIdStr);
    const isAdmin = req.user?.roles?.includes('admin');
    const isSelf = req.user?.id === targetUserId;
    
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    return handler(req, res);
  }),
  preventSelfDemotion: vi.fn((handler: any) => async (req: any, res: any) => {
    const targetUserId = parseInt(req.query.id as string);
    const isAdmin = req.user?.roles?.includes('admin');
    const isSelf = req.user?.id === targetUserId;
    
    if (isSelf && isAdmin && req.body.roles && !req.body.roles.includes('admin')) {
      return res.status(400).json({ error: 'Cannot remove your own admin role' });
    }
    
    if (isSelf && req.body.isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }
    
    return handler(req, res);
  }),
  validateBody: vi.fn((schema: any) => (handler: any) => async (req: any, res: any) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      if (error.details[0].path.includes('password')) {
        return res.status(400).json({
          error: 'Password does not meet policy requirements',
          details: ['Password must be at least 8 characters long'],
          code: 'INVALID_PASSWORD_POLICY',
        });
      }
      return res.status(400).json({ error: error.details[0].message });
    }
    req.body = value;
    return handler(req, res);
  }),
  validateQuery: vi.fn((schema: any) => (handler: any) => handler),
}));

// Now import the handler and other dependencies
import handler from '../lib/routes/users/[id]';
import prisma from '../lib/prisma';

// Create test utilities
function createMockAuthenticatedRequest(
  method: string,
  query: Record<string, string> = {},
  body: any = {},
  user: AuthenticatedRequest['user'] = { id: 1, email: 'test@example.com', roles: ['user'], isActive: true }
): AuthenticatedRequest {
  return {
    method,
    query,
    headers: {},
    body,
    cookies: {},
    user,
  } as AuthenticatedRequest;
}

function createMockResponse(): VercelResponse {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as any;
  return res;
}

function createMockUser(
  id: number,
  name: string,
  email: string,
  isActive: boolean = true,
  roles: string[] = ['user'],
  avatarUrl?: string
) {
  return {
    id,
    name,
    email,
    password: 'hashed-password',
    roles,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    avatarUrl: avatarUrl || null,
  };
}

describe('User Detail API - GET /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user when found', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const req = createMockAuthenticatedRequest('GET', { id: '1' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: mockUser });
  });

  it('should return 404 for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockAuthenticatedRequest('GET', { id: '999' }, {}, { 
      id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true 
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('should return 400 for invalid ID', async () => {
    const req = createMockAuthenticatedRequest('GET', { id: 'invalid' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid user ID' });
  });
});

describe('User Detail API - PUT /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow admin to update any user', async () => {
    const existingUser = createMockUser(2, 'John Doe', 'john@example.com');
    const updatedUser = { ...existingUser, name: 'John Smith' };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockAuthenticatedRequest(
      'PUT',
      { id: '2' },
      { name: 'John Smith' },
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should allow user to update their own profile', async () => {
    const existingUser = createMockUser(1, 'John Doe', 'john@example.com');
    const updatedUser = { ...existingUser, name: 'John Smith' };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockAuthenticatedRequest(
      'PUT',
      { id: '1' },
      { name: 'John Smith' },
      { id: 1, email: 'john@example.com', roles: ['user'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should prevent non-admin user from updating others', async () => {
    const req = createMockAuthenticatedRequest(
      'PUT',
      { id: '2' },
      { name: 'New Name' },
      { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permission denied' });
  });

  it('should prevent self-demotion from admin role', async () => {
    const req = createMockAuthenticatedRequest(
      'PUT',
      { id: '1' },
      { roles: ['user'] },
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot remove your own admin role' });
  });

  it('should prevent self-deactivation', async () => {
    const req = createMockAuthenticatedRequest(
      'PUT',
      { id: '1' },
      { isActive: false },
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot deactivate yourself' });
  });

  it('should validate password length', async () => {
    const req = createMockAuthenticatedRequest(
      'PUT',
      { id: '1' },
      { password: 'short' },
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
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

describe('User Detail API - DELETE /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete user when admin', async () => {
    const existingUser = createMockUser(2, 'John Doe', 'john@example.com');
    const deletedUser = { ...existingUser, isActive: false, deletedAt: new Date() };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(deletedUser);

    const req = createMockAuthenticatedRequest(
      'DELETE',
      { id: '2' },
      {},
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        isActive: false,
        deletedAt: expect.any(Date),
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        avatarUrl: true,
      },
    });
  });

  it('should prevent non-admin from deleting', async () => {
    const req = createMockAuthenticatedRequest(
      'DELETE',
      { id: '2' },
      {},
      { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
  });

  it('should prevent self-deletion', async () => {
    const req = createMockAuthenticatedRequest(
      'DELETE',
      { id: '1' },
      {},
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Self-deletion prevented',
      message: 'Administrators cannot delete their own account'
    });
  });
});

describe('User Detail API - POST /api/users/{id} (restore)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should restore deactivated user when admin', async () => {
    const existingUser = createMockUser(2, 'John Doe', 'john@example.com', false);
    const restoredUser = { ...existingUser, isActive: true, deletedAt: null };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(restoredUser);

    const req = createMockAuthenticatedRequest(
      'POST',
      { id: '2' },
      { action: 'restore' },
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        isActive: true,
        deletedAt: null,
        updatedAt: expect.any(Date),
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        avatarUrl: true,
      },
    });
  });

  it('should prevent non-admin from restoring', async () => {
    const req = createMockAuthenticatedRequest(
      'POST',
      { id: '2' },
      { action: 'restore' },
      { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
  });

  it('should handle invalid action', async () => {
    const req = createMockAuthenticatedRequest(
      'POST',
      { id: '2' },
      { action: 'invalid' },
      { id: 1, email: 'admin@example.com', roles: ['admin'], isActive: true }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid action' });
  });
});