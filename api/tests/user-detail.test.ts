import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser } from './utils/mocks';

// Mock prisma
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

// Mock auth functions
vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth');
  return {
    ...actual,
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    hashPassword: vi.fn(),
    setCORSHeaders: vi.fn(),
    setSecurityHeaders: vi.fn(),
  };
});

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

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
    validateBody: vi.fn((schema) => (handler) => async (req, res) => {
      // Process body through validation  
      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      req.body = value;
      return handler(req, res);
    }),
  };
});

vi.mock('../lib/middleware/index', async () => {
  const actual = await vi.importActual('../lib/middleware/index');
  return {
    ...actual,
    withCORS: vi.fn((handler) => handler), // Pass through for testing
    withErrorHandling: vi.fn((handler) => handler), // Pass through for testing
    withAuth: vi.fn((handler) => handler), // Pass through for testing
    withAdminRole: vi.fn((handler) => async (req, res) => {
      // Mock admin role check
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      return handler(req, res);
    }),
    withSelfOrAdmin: vi.fn((getUserId) => (handler) => async (req, res) => {
      // Mock self-or-admin check
      const userIdStr = getUserId(req);
      
      // Check if ID is valid number first
      if (isNaN(parseInt(userIdStr))) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const targetUserId = parseInt(userIdStr);
      const isAdmin = req.user?.roles?.includes('admin');
      const isSelf = req.user?.userId === targetUserId;
      
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      return handler(req, res);
    }),
    preventSelfDemotion: vi.fn((handler) => async (req, res) => {
      // Mock self-demotion prevention
      const targetUserId = parseInt(req.query.id as string);
      const isAdmin = req.user?.roles?.includes('admin');
      const isSelf = req.user?.userId === targetUserId;
      
      if (isSelf && isAdmin && req.body.roles && !req.body.roles.includes('admin')) {
        return res.status(400).json({ error: 'Cannot remove your own admin role' });
      }
      
      if (isSelf && req.body.isActive === false) {
        return res.status(400).json({ error: 'Cannot deactivate yourself' });
      }
      
      return handler(req, res);
    }),
    validateBody: vi.fn((schema) => (handler) => async (req, res) => {
      // Process body through validation  
      const { error, value } = schema.validate(req.body);
      if (error) {
        // Format validation error similar to the actual middleware
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
    validateQuery: vi.fn((schema) => (handler) => handler),
  };
});

// Mock password validation
vi.mock('../lib/validation', async () => {
  const actual = await vi.importActual('../lib/validation');
  return {
    ...actual,
    validatePasswordPolicy: vi.fn((password) => {
      if (password.length < 8) {
        return {
          valid: false,
          errors: ['Password must be at least 8 characters long']
        };
      }
      return { valid: true, errors: [] };
    }),
  };
});

import { hashPassword, requireAuth, requireRole } from '../lib/auth';
import prisma from '../lib/prisma';
import handler from '../users/[id]';

describe('User Detail API - GET /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
  });

  it('should return user when found', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const req = createMockRequest('GET', { id: '1' }, { user: { id: 1, userId: 1, email: 'admin@example.com', roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: mockUser });
  });

  it('should return 404 for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest('GET', { id: '999' }, { user: { id: 1, userId: 1, email: 'admin@example.com', roles: ['admin', 'user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('should return inactive user (admins can see inactive users)', async () => {
    const inactiveUser = createMockUser(1, 'Inactive User', 'inactive@example.com', false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUser);

    const req = createMockRequest('GET', { id: '1' }, { user: { id: 1, userId: 1, email: 'admin@example.com', roles: ['admin', 'user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: inactiveUser });
  });

  it('should return 400 for invalid ID', async () => {
    const req = createMockRequest(
      'GET',
      { id: 'invalid' },
      { user: { id: 1, userId: 1, email: 'admin@example.com', roles: ['user'] } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid user ID' });
  });
});

describe('User Detail API - PUT /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');
  });

  it('should allow admin to update any user', async () => {
    const existingUser = createMockUser(2, 'Jane Doe', 'jane@example.com');
    const updatedUser = { ...existingUser, name: 'Jane Smith' };

    vi.mocked(requireRole).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest(
      'PUT',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { name: 'Jane Smith' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User updated successfully',
      data: updatedUser,
    });
  });

  it('should allow user to update their own profile', async () => {
    const existingUser = createMockUser(1, 'John Doe', 'john@example.com');
    const updatedUser = { ...existingUser, name: 'John Smith' };

    vi.mocked(requireRole).mockReturnValue(false); // Not admin
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest(
      'PUT',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
        body: { name: 'John Smith' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should prevent non-admin user from updating others', async () => {
    vi.mocked(requireRole).mockReturnValue(false); // Not admin

    const req = createMockRequest(
      'PUT',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
        body: { name: 'New Name' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permission denied' });
  });

  it('should prevent self-demotion from admin role', async () => {
    const adminUser = createMockUser(1, 'Admin User', 'admin@example.com', true, ['user', 'admin']);

    vi.mocked(requireRole).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);

    const req = createMockRequest(
      'PUT',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { roles: ['user'] }, // Trying to remove admin role
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot remove your own admin role' });
  });

  it('should prevent self-deactivation', async () => {
    const adminUser = createMockUser(1, 'Admin User', 'admin@example.com');

    vi.mocked(requireRole).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);

    const req = createMockRequest(
      'PUT',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { isActive: false },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot deactivate yourself' });
  });

  it('should prevent non-admin from updating email', async () => {
    const existingUser = createMockUser(1, 'User', 'user@example.com');

    vi.mocked(requireRole).mockReturnValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest(
      'PUT',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
        body: { email: 'newemail@example.com' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only admins can update email addresses' });
  });

  it('should prevent non-admin from updating roles', async () => {
    const existingUser = createMockUser(1, 'User', 'user@example.com');

    vi.mocked(requireRole).mockReturnValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest(
      'PUT',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
        body: { roles: ['user', 'admin'] },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only admins can update user roles' });
  });

  it('should validate password length', async () => {
    const existingUser = createMockUser(1, 'User', 'user@example.com');

    vi.mocked(requireRole).mockReturnValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest(
      'PUT',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
        body: { password: 'short' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password does not meet policy requirements',
      details: expect.arrayContaining(['Password must be at least 8 characters long']),
      code: 'INVALID_PASSWORD_POLICY',
    });
  });
});

describe('User Detail API - DELETE /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(requireRole).mockReturnValue(true);
  });

  it('should soft delete user when admin', async () => {
    const existingUser = createMockUser(2, 'To Delete', 'delete@example.com');
    const deletedUser = { ...existingUser, isActive: false };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(deletedUser);

    const req = createMockRequest(
      'DELETE',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        isActive: false,
        deletedAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User deleted successfully',
      data: deletedUser,
    });
  });

  it('should prevent non-admin from deleting', async () => {
    vi.mocked(requireRole).mockReturnValue(false);

    const req = createMockRequest(
      'DELETE',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
  });

  it('should prevent self-deletion', async () => {
    const req = createMockRequest(
      'DELETE',
      { id: '1' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ 
      error: 'Self-deletion prevented',
      message: 'Administrators cannot delete their own account'
    });
  });

  it('should handle already deleted user', async () => {
    const alreadyDeleted = createMockUser(2, 'Deleted', 'deleted@example.com', false);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(alreadyDeleted);

    const req = createMockRequest(
      'DELETE',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User is already deleted' });
  });

  it('should handle non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest(
      'DELETE',
      { id: '999' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });
});

describe('User Detail API - POST /api/users/{id} (restore)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(requireRole).mockReturnValue(true);
  });

  it('should restore deactivated user when admin', async () => {
    const deactivatedUser = createMockUser(2, 'Deactivated User', 'inactive@example.com', false);
    const restoredUser = { ...deactivatedUser, isActive: true, deletedAt: null };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(deactivatedUser);
    vi.mocked(prisma.user.update).mockResolvedValue(restoredUser);

    const req = createMockRequest(
      'POST',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { action: 'restore' },
      }
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
      select: expect.any(Object),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User restored successfully',
      data: restoredUser,
    });
  });

  it('should prevent non-admin from restoring', async () => {
    vi.mocked(requireRole).mockReturnValue(false);

    const req = createMockRequest(
      'POST',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['user'] },
        body: { action: 'restore' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
  });

  it('should handle already active user', async () => {
    const activeUser = createMockUser(2, 'Active User', 'active@example.com', true);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);

    const req = createMockRequest(
      'POST',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { action: 'restore' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User is already active' });
  });

  it('should handle non-existent user for restore', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest(
      'POST',
      { id: '999' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { action: 'restore' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('should handle invalid action', async () => {
    const req = createMockRequest(
      'POST',
      { id: '2' },
      {
        user: { id: 1, userId: 1, email: 'test@example.com', roles: ['admin'] },
        body: { action: 'invalid' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid action' });
  });
});
