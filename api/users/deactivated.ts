import type { VercelResponse } from '@vercel/node';
import { 
  withCORS, 
  withErrorHandling, 
  withAuth, 
  withAdminRole,
  validateQuery,
  type AuthenticatedRequest 
} from '../lib/middleware/index.js';
import prisma from '../lib/prisma.js';
import { getUsersSchema } from '../lib/schemas/user.js';

// GET /api/users/deactivated - List deactivated users (admin only)
const getDeactivatedUsersHandler = withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        validateQuery(getUsersSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            return handleGetDeactivatedUsers(req, res);
          }
        )
      )
    )
  )
);

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return getDeactivatedUsersHandler(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetDeactivatedUsers(req: AuthenticatedRequest, res: VercelResponse) {
  // Query parameters are already validated by middleware, admin role already checked
  const { page, size, search, sort, order } = req.query as any;

  // Build where clause - only deactivated users
  const where: any = {
    isActive: false,
    deletedAt: { not: null }
  };

  // Handle search (OR on name and email)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * size;

  // Execute queries
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
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
      orderBy: { [sort]: order },
      skip,
      take: size,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / size);

  return res.status(200).json({
    data: users,
    pagination: {
      page,
      size,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}