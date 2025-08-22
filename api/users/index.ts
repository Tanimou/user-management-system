import type { VercelResponse } from '@vercel/node';
import {
  hashPassword,
  requireAuth,
  requireRole,
  setCORSHeaders,
  setSecurityHeaders,
  type AuthenticatedRequest,
} from '../lib/auth.js';
import prisma, { USER_SELECT_FIELDS } from '../lib/prisma.js';
import { validatePasswordPolicy, validateEmail, validateName } from '../lib/validation.js';
import { validateRoles } from '../lib/role-validation.js';
import { logUserCreation } from '../lib/audit-logger.js';
import { getValidatedSorting } from '../lib/sorting.js';

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
      role,
      createdFrom,
      createdTo,
      orderBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // Parse and validate pagination parameters
    let pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(size as string) || 10));
    
    // Calculate total first to validate page number
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

    // Handle role filter
    if (role && typeof role === 'string') {
      const validRoles = ['user', 'admin'];
      if (validRoles.includes(role)) {
        where.roles = { has: role };
      }
    }

    // Handle date range filtering
    const createdAtFilter: any = {};
    if (createdFrom && typeof createdFrom === 'string') {
      try {
        createdAtFilter.gte = new Date(createdFrom);
      } catch (error) {
        // Invalid date format, ignore
      }
    }
    if (createdTo && typeof createdTo === 'string') {
      try {
        // Set to end of day for the "to" date
        const toDate = new Date(createdTo);
        toDate.setHours(23, 59, 59, 999);
        createdAtFilter.lte = toDate;
      } catch (error) {
        // Invalid date format, ignore
      }
    }
    if (Object.keys(createdAtFilter).length > 0) {
      where.createdAt = createdAtFilter;
    }

    // Get total count first for page validation
    // Get total count first for page validation
    const total = await prisma.user.count({ where });
    const maxPages = Math.max(1, Math.ceil(total / pageSize));
    
    // Ensure page number doesn't exceed available pages
    if (pageNum > maxPages) {
      pageNum = maxPages;
    }
    
    const skip = (pageNum - 1) * pageSize;

    // Handle sorting
    const { sortField, sortOrder } = getValidatedSorting(orderBy, order);


    // Execute queries
    const users = await prisma.user.findMany({
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
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startItem = total === 0 ? 0 : skip + 1;
    const endItem = Math.min(skip + pageSize, total);

    return res.status(200).json({
      data: users,
      pagination: {
        page: pageNum,
        size: pageSize,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        startItem,
        endItem,
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

    // Validate roles using utility function
    if (!validateRoles(roles)) {
      return res.status(400).json({ error: 'Roles must be an array containing valid roles and at least "user"' });
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

    // Log user creation for audit trail
    await logUserCreation(req, user.id, { name: user.name, email: user.email, roles: user.roles });

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
