import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from './lib/prisma.js';
import {
  requireAuth,
  hashPassword,
  setCORSHeaders,
  setSecurityHeaders,
  type AuthenticatedRequest,
} from './lib/auth.js';

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
    return handleGetProfile(req, res);
  } else if (req.method === 'PUT') {
    return handleUpdateProfile(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetProfile(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = req.user!.userId;

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

    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'User not found or inactive' });
    }

    return res.status(200).json({ data: user });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleUpdateProfile(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = req.user!.userId;
    const { name, password } = req.body;

    // Build update data (only allow name and password updates)
    const updateData: any = {};

    // Handle name update
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 120) {
        return res.status(400).json({ error: 'Name must be a string with max 120 characters' });
      }
      updateData.name = name.trim();
    }

    // Handle password update
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }
      updateData.password = await hashPassword(password);
    }

    // If no valid updates provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update user profile
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
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}