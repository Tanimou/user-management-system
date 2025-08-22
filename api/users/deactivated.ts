import type { VercelResponse } from '@vercel/node';
import {
  requireAuth,
  requireRole,
  setCORSHeaders,
  setSecurityHeaders,
  type AuthenticatedRequest,
} from '../lib/auth.js';
import prisma from '../lib/prisma.js';

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authenticate user for all requests
  const isAuthenticated = await requireAuth(req, res);
  if (!isAuthenticated) return;

  if (req.method === 'GET') {
    return handleGetDeactivatedUsers(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetDeactivatedUsers(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    // Check if user has admin role
    if (!requireRole(req.user, ['admin'])) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const {
      page = '1',
      size = '10',
      search = '',
      orderBy = 'deletedAt',
      order = 'desc',
    } = req.query;

    // Parse and validate pagination parameters
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(size as string) || 10));
    const skip = (pageNum - 1) * pageSize;

    // Build where clause - only deactivated users
    const where: any = {
      isActive: false,
      deletedAt: { not: null }
    };

    // Handle search (OR on name and email)
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Handle sorting
    const validOrderBy = ['name', 'email', 'createdAt', 'deletedAt'];
    const validOrder = ['asc', 'desc'];

    const sortField = validOrderBy.includes(orderBy as string) ? (orderBy as string) : 'deletedAt';
    const sortOrder = validOrder.includes(order as string) ? (order as string) : 'desc';

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
        orderBy: { [sortField]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      data: users,
      pagination: {
        page: pageNum,
        size: pageSize,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Get deactivated users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}