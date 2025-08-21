import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../lib/prisma';
import {
  requireAuth,
  requireRole,
  hashPassword,
  setCORSHeaders,
  setSecurityHeaders,
  type AuthenticatedRequest,
} from '../lib/auth';

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

  const { id } = req.query;
  const userId = parseInt(id as string);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (req.method === 'GET') {
    return handleGetUser(req, res, userId);
  } else if (req.method === 'PUT') {
    return handleUpdateUser(req, res, userId);
  } else if (req.method === 'DELETE') {
    return handleDeleteUser(req, res, userId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ data: user });

  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleUpdateUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
  try {
    const { name, email, password, roles, isActive } = req.body;
    const isAdmin = requireRole(req.user, ['admin']);
    const isSelf = req.user?.userId === userId;

    // Check permissions
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Find user
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update data
    const updateData: any = {};

    // Handle name update
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 120) {
        return res.status(400).json({ error: 'Name must be a string with max 120 characters' });
      }
      updateData.name = name.trim();
    }

    // Handle email update (admin only)
    if (email !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can update email addresses' });
      }
      
      if (typeof email !== 'string' || email.length > 180) {
        return res.status(400).json({ error: 'Email must be a string with max 180 characters' });
      }
      
      updateData.email = email.toLowerCase().trim();
    }

    // Handle password update
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }
      updateData.password = await hashPassword(password);
    }

    // Handle roles update (admin only)
    if (roles !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can update user roles' });
      }
      
      if (!Array.isArray(roles) || !roles.includes('user')) {
        return res.status(400).json({ error: 'Roles must be an array containing at least "user"' });
      }

      // Prevent self-demotion guard
      if (isSelf && existingUser.roles.includes('admin') && !roles.includes('admin')) {
        return res.status(400).json({ error: 'Cannot remove admin role from yourself' });
      }

      updateData.roles = roles;
    }

    // Handle isActive update (admin only)
    if (isActive !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can activate/deactivate users' });
      }

      // Prevent self-deactivation guard
      if (isSelf && !isActive) {
        return res.status(400).json({ error: 'Cannot deactivate yourself' });
      }

      updateData.isActive = Boolean(isActive);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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

    return res.status(200).json({
      message: 'User updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDeleteUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
  try {
    // Check if user has admin role
    if (!requireRole(req.user, ['admin'])) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    // Prevent self-deletion guard
    if (req.user?.userId === userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Find user
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!existingUser.isActive) {
      return res.status(400).json({ error: 'User is already deleted' });
    }

    // Soft delete (set isActive = false)
    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
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

    return res.status(200).json({
      message: 'User deleted successfully',
      data: deletedUser
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}