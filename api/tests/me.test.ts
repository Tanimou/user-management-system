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
    hashPassword: vi.fn(),
    setCORSHeaders: vi.fn(),
    setSecurityHeaders: vi.fn(),
  };
});

import handler from '../me';
import prisma from '../lib/prisma';
import { requireAuth, hashPassword } from '../lib/auth';

describe('User Profile API - GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
  });

  it('should return current user profile', async () => {
    const currentUser = createMockUser(1, 'Current User', 'current@example.com');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(currentUser);

    const req = createMockRequest('GET', {}, { user: { userId: 1, roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        avatarUrl: true
      }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: currentUser });
  });

  it('should return 404 for inactive user', async () => {
    const inactiveUser = createMockUser(1, 'Inactive User', 'inactive@example.com', false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUser);

    const req = createMockRequest('GET', {}, { user: { userId: 1, roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found or inactive' });
  });

  it('should return 404 for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createMockRequest('GET', {}, { user: { userId: 999, roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found or inactive' });
  });
});

describe('User Profile API - PUT /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue('new-hashed-password');
  });

  it('should update user name', async () => {
    const updatedUser = createMockUser(1, 'Updated Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: { name: 'Updated Name' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Updated Name' },
      select: expect.any(Object)
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Profile updated successfully',
      data: updatedUser
    });
  });

  it('should update user password', async () => {
    const updatedUser = createMockUser(1, 'User', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: { password: 'newpassword123' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(hashPassword).toHaveBeenCalledWith('newpassword123');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password: 'new-hashed-password' },
      select: expect.any(Object)
    });
  });

  it('should update both name and password', async () => {
    const updatedUser = createMockUser(1, 'New Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: { name: 'New Name', password: 'newpassword123' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'New Name', password: 'new-hashed-password' },
      select: expect.any(Object)
    });
  });

  it('should validate name length', async () => {
    const longName = 'a'.repeat(121); // Exceeds 120 character limit

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: { name: longName }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name must be a string with max 120 characters' });
  });

  it('should validate password length', async () => {
    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: { password: 'short' } // Less than 8 characters
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Password must be at least 8 characters long' });
  });

  it('should trim whitespace from name', async () => {
    const updatedUser = createMockUser(1, 'Trimmed Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: { name: '  Trimmed Name  ' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Trimmed Name' },
      select: expect.any(Object)
    });
  });

  it('should return error when no valid fields provided', async () => {
    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: {} // Empty body
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No valid fields to update' });
  });

  it('should ignore invalid fields', async () => {
    const updatedUser = createMockUser(1, 'Valid Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, roles: ['user'] },
      body: {
        name: 'Valid Name',
        email: 'ignored@example.com', // Should be ignored
        roles: ['admin'], // Should be ignored
        isActive: false // Should be ignored
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Valid Name' }, // Only name should be included
      select: expect.any(Object)
    });
  });
});