import type { VercelResponse } from '@vercel/node';
import {
  hashPassword,
  requireAuth,
  requireRole,
  setCORSHeaders,
  setSecurityHeaders,
  type AuthenticatedRequest,
} from '../lib/auth.js';
import prisma from '../lib/prisma.js';
import { validatePasswordPolicy, validateEmail, validateName } from '../lib/validation.js';

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
    return handleGetUsers(req, res);
  } else if (req.method === 'POST') {
    return handleCreateUser(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetUsers(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const {
      page = '1',
      size = '10',
      search = '',
      active,
      orderBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // Parse and validate pagination parameters
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(size as string) || 10));
    const skip = (pageNum - 1) * pageSize;

    // Build where clause
    const where: any = {};

    // Handle search (OR on name and email)
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Handle active filter
    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    // Handle sorting
    const validOrderBy = ['name', 'email', 'createdAt'];
    const validOrder = ['asc', 'desc'];

    const sortField = validOrderBy.includes(orderBy as string) ? (orderBy as string) : 'createdAt';
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
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateUser(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    // Check if user has admin role
    if (!requireRole(req.user, ['admin'])) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const { name, email, password, roles = ['user'] } = req.body;

    // Validate input using enhanced validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate name
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid name',
        details: nameValidation.errors,
        code: 'INVALID_NAME'
      });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid email',
        details: emailValidation.errors,
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password policy
    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet policy requirements',
        details: passwordValidation.errors,
        code: 'INVALID_PASSWORD_POLICY'
      });
    }

    if (!Array.isArray(roles) || !roles.includes('user')) {
      return res.status(400).json({ error: 'Roles must be an array containing at least "user"' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.isActive) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user (or reactivate if soft-deleted)
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
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

    return res.status(201).json({
      message: 'User created successfully',
      data: user,
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
