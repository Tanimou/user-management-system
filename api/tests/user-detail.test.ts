import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser, createMockJWTPayload } from './utils/mocks';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  }
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

import handler from '../users/[id]';
import prisma from '../lib/prisma';
import { requireAuth, requireRole, hashPassword } from '../lib/auth';

describe('User Detail API - GET /api/users/{id}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
  });

  it('should return user when found', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

    const req = createMockRequest('GET', { id: '1' }, { user: { userId: 1, roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: mockUser });
  });

  it('should return 404 for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest('GET', { id: '999' }, { user: { userId: 1, roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('should return inactive user (admins can see inactive users)', async () => {
    const inactiveUser = createMockUser(1, 'Inactive User', 'inactive@example.com', false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUser);

    const req = createMockRequest('GET', { id: '1' }, { user: { userId: 1, roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: inactiveUser });
  });

  it('should return 400 for invalid ID', async () => {
    const req = createMockRequest('GET', { id: 'invalid' }, { user: { userId: 1, roles: ['user'] } });
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

    const req = createMockRequest('PUT', { id: '2' }, {
      user: { userId: 1, roles: ['admin'] },
      body: { name: 'Jane Smith' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User updated successfully',
      data: updatedUser
    });
  });

  it('should allow user to update their own profile', async () => {
    const existingUser = createMockUser(1, 'John Doe', 'john@example.com');
    const updatedUser = { ...existingUser, name: 'John Smith' };
    
    vi.mocked(requireRole).mockReturnValue(false); // Not admin
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', { id: '1' }, {
      user: { userId: 1, roles: ['user'] },
      body: { name: 'John Smith' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should prevent non-admin user from updating others', async () => {
    vi.mocked(requireRole).mockReturnValue(false); // Not admin

    const req = createMockRequest('PUT', { id: '2' }, {
      user: { userId: 1, roles: ['user'] },
      body: { name: 'New Name' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permission denied' });
  });

  it('should prevent self-demotion from admin role', async () => {
    const adminUser = createMockUser(1, 'Admin User', 'admin@example.com', true, ['user', 'admin']);
    
    vi.mocked(requireRole).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);

    const req = createMockRequest('PUT', { id: '1' }, {
      user: { userId: 1, roles: ['admin'] },
      body: { roles: ['user'] } // Trying to remove admin role
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot remove your own admin role' });
  });

  it('should prevent self-deactivation', async () => {
    const adminUser = createMockUser(1, 'Admin User', 'admin@example.com');
    
    vi.mocked(requireRole).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);

    const req = createMockRequest('PUT', { id: '1' }, {
      user: { userId: 1, roles: ['admin'] },
      body: { isActive: false }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot deactivate yourself' });
  });

  it('should prevent non-admin from updating email', async () => {
    const existingUser = createMockUser(1, 'User', 'user@example.com');
    
    vi.mocked(requireRole).mockReturnValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest('PUT', { id: '1' }, {
      user: { userId: 1, roles: ['user'] },
      body: { email: 'newemail@example.com' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only admins can update email addresses' });
  });

  it('should prevent non-admin from updating roles', async () => {
    const existingUser = createMockUser(1, 'User', 'user@example.com');
    
    vi.mocked(requireRole).mockReturnValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest('PUT', { id: '1' }, {
      user: { userId: 1, roles: ['user'] },
      body: { roles: ['user', 'admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only admins can update user roles' });
  });

  it('should validate password length', async () => {
    const existingUser = createMockUser(1, 'User', 'user@example.com');
    
    vi.mocked(requireRole).mockReturnValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest('PUT', { id: '1' }, {
      user: { userId: 1, roles: ['user'] },
      body: { password: 'short' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password does not meet policy requirements',
      details: expect.arrayContaining([
        'Password must be at least 8 characters long'
      ]),
      code: 'INVALID_PASSWORD_POLICY'
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

    const req = createMockRequest('DELETE', { id: '2' }, {
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isActive: false },
      select: expect.any(Object)
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User deleted successfully',
      data: deletedUser
    });
  });

  it('should prevent non-admin from deleting', async () => {
    vi.mocked(requireRole).mockReturnValue(false);

    const req = createMockRequest('DELETE', { id: '2' }, {
      user: { userId: 1, roles: ['user'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
  });

  it('should prevent self-deletion', async () => {
    const req = createMockRequest('DELETE', { id: '1' }, {
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot delete yourself' });
  });

  it('should handle already deleted user', async () => {
    const alreadyDeleted = createMockUser(2, 'Deleted', 'deleted@example.com', false);
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue(alreadyDeleted);

    const req = createMockRequest('DELETE', { id: '2' }, {
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User is already deleted' });
  });

  it('should handle non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest('DELETE', { id: '999' }, {
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });
});