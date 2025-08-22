import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser, createMockJWTPayload } from './utils/mocks';

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
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
    withErrorHandling: vi.fn((handler) => async (req, res) => {
      // Mock error handling middleware
      try {
        return await handler(req, res);
      } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }),
    withAuth: vi.fn((handler) => handler), // Pass through for testing
  };
});

import handler from '../me';
import prisma from '../lib/prisma';
import { requireAuth, hashPassword } from '../lib/auth';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../lib/middleware/enhanced-auth';
import { updateUserSchema } from '../lib/schemas/user';

describe('User Profile API - GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock JWT verification to return a valid payload
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 1,
      email: 'user@example.com', 
      roles: ['user']
    } as any);
    
    // Mock verifyToken to return successful auth
    vi.mocked(verifyToken).mockResolvedValue({
      authenticated: true,
      user: {
        id: 1,
        email: 'user@example.com',
        roles: ['user'],
        isActive: true
      }
    });
    
    vi.mocked(requireAuth).mockResolvedValue(true);
  });

  it('should return current user profile', async () => {
    const currentUser = createMockUser(1, 'Current User', 'current@example.com');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(currentUser);

    const req = createMockRequest('GET', {}, { user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' } });
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

    const req = createMockRequest('GET', {}, { user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' } });
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
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
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
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
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
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
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
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
      body: { name: longName }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: '"name" length must be less than or equal to 120 characters long' });
  });

  it('should validate password length', async () => {
    const req = createMockRequest('PUT', {}, {
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
      body: { password: 'short' } // Less than 8 characters
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: '"password" length must be at least 8 characters long' });
  });

  it('should trim whitespace from name', async () => {
    const updatedUser = createMockUser(1, 'Trimmed Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
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
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
      body: {} // Empty body
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: '"value" must have at least 1 key' });
  });

  it('should ignore invalid fields', async () => {
    const updatedUser = createMockUser(1, 'Valid Name', 'user@example.com');
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const req = createMockRequest('PUT', {}, {
      user: { id: 1, email: 'user@example.com', roles: ['user'], isActive: true }, headers: { authorization: 'Bearer valid-token' },
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