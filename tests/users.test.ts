import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser } from './utils/mocks';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
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

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
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
  };
});

import { hashPassword, requireAuth, requireRole } from '../lib/auth';
import prisma from '../lib/prisma';
import handler from '../lib/routes/users/index';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../lib/middleware/enhanced-auth';


describe('Users API - GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock JWT verification to return a valid payload
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 1,
      email: 'test@example.com', 
      roles: ['user']
    } as any);
    
    // Mock verifyToken to return successful auth
    vi.mocked(verifyToken).mockResolvedValue({
      authenticated: true,
      user: {
        id: 1,
        email: 'test@example.com',
        roles: ['user'],
        isActive: true
      }
    });
    
    vi.mocked(requireAuth).mockResolvedValue(true);
  });

  it('should return paginated users with default parameters', async () => {
    const mockUsers = [
      createMockUser(1, 'John Doe', 'john@example.com'),
      createMockUser(2, 'Jane Smith', 'jane@example.com'),
    ];

    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);
    vi.mocked(prisma.user.count).mockResolvedValue(2);

    const req = createMockRequest('GET', {}, { 
      user: { userId: 1, roles: ['user'] },
      headers: { authorization: 'Bearer valid-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: mockUsers,
      pagination: {
        page: 1,
        size: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        startItem: 1,
        endItem: 2,
      },
    });
  });

  it('should handle search functionality', async () => {
    const mockUsers = [createMockUser(1, 'John Doe', 'john@example.com')];

    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const req = createMockRequest(
      'GET',
      { search: 'john' },
      { 
        user: { userId: 1, roles: ['user'] },
        headers: { authorization: 'Bearer valid-token' }
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        },
      })
    );
  });

  it('should handle pagination parameters', async () => {
    const mockUsers = [createMockUser(1, 'User 1', 'user1@example.com')];
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);
    vi.mocked(prisma.user.count).mockResolvedValue(10); // Set a total that allows page 2

    const req = createMockRequest(
      'GET',
      { page: '2', size: '5' },
      { user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5, // (2-1) * 5
        take: 5,
      })
    );
  });

  it('should handle active filter', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      { active: 'true' },
      { user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      })
    );
  });

  it('should handle sorting parameters', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      { sort: 'name', order: 'asc' },
      { 
        user: { userId: 1, roles: ['user'] },
        headers: { authorization: 'Bearer valid-token' }
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      })
    );
  });

  it('should handle role filter', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      { role: 'admin' },
      { user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roles: { has: 'admin' } },
      })
    );
  });

  it('should handle updatedAt sorting', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      { sort: 'updatedAt', order: 'desc' },
      { 
        user: { userId: 1, roles: ['user'] },
        headers: { authorization: 'Bearer valid-token' }
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: 'desc' },
      })
    );
  });

  it('should ignore invalid role filter', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      { role: 'invalid' },
      { user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('should handle date range filtering', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      {
        createdFrom: '2023-01-01',
        createdTo: '2023-12-31',
      },
      { user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2023-01-01'),
            lte: expect.any(Date), // End of day for 2023-12-31
          },
        },
      })
    );
  });

  it('should handle partial date range filtering', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = createMockRequest(
      'GET',
      { createdFrom: '2023-01-01' },
      { user: { userId: 1, roles: ['user'] }, headers: { authorization: 'Bearer valid-token' } }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2023-01-01'),
          },
        },
      })
    );
  });
});

describe('Users API - POST /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(true);
    vi.mocked(requireRole).mockReturnValue(true);
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');
  });

  it('should create user when admin', async () => {
    const newUser = createMockUser(1, 'New User', 'new@example.com');

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(newUser);

    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['admin'] },
        body: {
          name: 'New User',
          email: 'new@example.com',
          password: 'Password123!',
          roles: ['user'],
        },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created successfully',
      data: newUser,
    });
  });

  it('should reject creation when not admin', async () => {
    vi.mocked(requireRole).mockReturnValue(false);

    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['user'] },
        body: { name: 'Test', email: 'test@example.com', password: 'Password123!' },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
  });

  it('should validate required fields', async () => {
    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['admin'] },
        body: { name: 'Test' }, // Missing email and password
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: '"email" is required' });
  });

  it('should validate password length', async () => {
    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['admin'] },
        body: {
          name: 'Test',
          email: 'test@example.com',
          password: 'short', // Less than 8 characters
        },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: '"password" length must be at least 8 characters long' });
  });

  it('should validate roles array', async () => {
    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['admin'], headers: { authorization: 'Bearer valid-token' } },
        body: {
          name: 'Test',
          email: 'test@example.com',
          password: 'Password123!',
          roles: ['invalid-role'], // Invalid role
        },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ 
      error: '"roles[0]" must be one of [user, admin]' 
    });
  });

  it('should handle duplicate email', async () => {
    const existingUser = createMockUser(1, 'Existing', 'existing@example.com', true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['admin'] },
        body: {
          name: 'New User',
          email: 'existing@example.com',
          password: 'Password123!',
        },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'User with this email already exists' });
  });

  it('should reactivate soft-deleted user', async () => {
    const softDeletedUser = createMockUser(1, 'Deleted', 'deleted@example.com', false);
    const reactivatedUser = createMockUser(1, 'Reactivated', 'deleted@example.com', true);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(softDeletedUser);
    vi.mocked(prisma.user.update).mockResolvedValue(reactivatedUser);

    const req = createMockRequest(
      'POST',
      {},
      {
        user: { userId: 1, roles: ['admin'] },
        body: {
          name: 'Reactivated',
          email: 'deleted@example.com',
          password: 'Password123!',
        },
      }
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: softDeletedUser.id },
      data: expect.objectContaining({
        name: 'Reactivated',
        email: 'deleted@example.com',
        isActive: true,
      }),
      select: expect.any(Object),
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
