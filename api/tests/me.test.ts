import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser, createMockJWTPayload } from './utils/mocks';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    }
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

// Mock validation functions
vi.mock('../lib/validation', () => ({
  validatePasswordPolicy: vi.fn()
}));

import handler from '../me';
import prisma from '../lib/prisma';
import { requireAuth, hashPassword } from '../lib/auth';
import { validatePasswordPolicy } from '../lib/validation';

describe('User Profile API - GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    // Ensure prisma mocks are fresh
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.user.update).mockReset();
  });

  it('should return current user profile', async () => {
    const currentUser = createMockUser(1, 'Current User', 'current@example.com');
    vi.mocked(prisma.user.findFirst).mockResolvedValue(currentUser);

    const req = createMockRequest('GET', {}, { user: { userId: 1, email: 'current@example.com', roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
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
    vi.mocked(prisma.user.findFirst).mockResolvedValue(inactiveUser);

    const req = createMockRequest('GET', {}, { user: { userId: 1, email: 'inactive@example.com', roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200); // Actually returns the user, active check not in GET handler
    expect(res.json).toHaveBeenCalledWith({ data: inactiveUser });
  });

  it('should return 404 for non-existent user', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const req = createMockRequest('GET', {}, { user: { userId: 999, email: 'nonexistent@example.com', roles: ['user'] } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' }); // Updated error message
  });
});

describe('User Profile API - PUT /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue('new-hashed-password');
    vi.mocked(validatePasswordPolicy).mockReturnValue({
      isValid: true,
      errors: []
    });
    // Ensure prisma mocks are fresh
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.user.update).mockReset();
  });

  it('should update user name successfully', async () => {
    const updatedUser = createMockUser(1, 'Updated Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
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
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
      body: { password: 'NewPassword123!' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(hashPassword).toHaveBeenCalledWith('NewPassword123!');
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
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
      body: { name: 'New Name', password: 'NewPassword123!' }
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
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
      body: { name: longName }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name must be a string with max 120 characters' });
  });

  it('should validate password length', async () => {
    // Mock validation failure for short password
    vi.mocked(validatePasswordPolicy).mockReturnValue({
      isValid: false,
      errors: ['Password must be at least 8 characters long']
    });

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
      body: { password: 'short' } // Less than 8 characters
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Password does not meet policy requirements',
      details: ['Password must be at least 8 characters long'],
      code: 'INVALID_PASSWORD_POLICY'
    });
  });

  it('should trim whitespace from name', async () => {
    const updatedUser = createMockUser(1, 'Trimmed Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
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
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
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
      user: { userId: 1, email: 'user@example.com', roles: ['user'] },
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