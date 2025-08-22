import type { VercelResponse } from '@vercel/node';
import { logUserCreation } from '../lib/audit-logger.js';
import { hashPassword } from '../lib/auth.js';
import { 
  withCORS, 
  withErrorHandling, 
  withAuth, 
  withAdminRole,
  validateBody,
  validateQuery,
  type AuthenticatedRequest 
} from '../lib/middleware/index.js';
import prisma from '../lib/prisma.js';
import { createUserSchema, getUsersSchema } from '../lib/schemas/user.js';

// GET /api/users - List users (authenticated users can read)
const getUsersHandler = withCORS(
  withErrorHandling(
    withAuth(
      validateQuery(getUsersSchema)(
        async (req: AuthenticatedRequest, res: VercelResponse) => {
          await handleGetUsers(req, res);
        }
      )
    )
  )
);

// POST /api/users - Create user (admin only)
const createUserHandler = withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        validateBody(createUserSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            await handleCreateUser(req, res);
          }
        )
      )
    )
  )
);

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    await getUsersHandler(req, res);
  } else if (req.method === 'POST') {
    await createUserHandler(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetUsers(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  // Query parameters are already validated by middleware
  const { page, size, search, active, sort, order } = req.query as any;

  const where: any = {};

  // Handle search (OR on name and email)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Handle active filter
  if (active !== undefined) {
    where.isActive = active;
  }

  // Get total count
  const total = await prisma.user.count({ where });
  const skip = (page - 1) * size;

  // Get users with pagination and sorting
  const users = await prisma.user.findMany({
    where,
    skip,
    take: size,
    orderBy: { [sort]: order },
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

  const totalPages = Math.ceil(total / size) || 1;
  const startItem = total === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + size, total);

  res.status(200).json({
    data: users,
    pagination: {
      page,
      size,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      startItem,
      endItem,
    },
  });
}

async function handleCreateUser(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  // Body is already validated by middleware, admin role is already checked
  const { name, email, password, roles } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.isActive) {
    res.status(409).json({ error: 'User with this email already exists' });
    return;
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user (or reactivate if soft-deleted)
  const userData = {
    name,
    email,
    password: hashedPassword,
    roles,
    isActive: true,
    deletedAt: null,
    updatedAt: new Date(),
  };

  let user;
  if (existingUser && !existingUser.isActive) {
    // Reactivate soft-deleted user
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: userData,
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
  } else {
    // Create new user
    user = await prisma.user.create({
      data: userData,
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
  }

  // Log user creation for audit trail
  await logUserCreation(req, user.id, { name: user.name, email: user.email, roles: user.roles });

  res.status(201).json({
    message: 'User created successfully',
    data: user,
  });
}
