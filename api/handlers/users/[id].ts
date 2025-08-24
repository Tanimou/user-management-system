import type { VercelResponse } from '@vercel/node';
import { logRoleChange, logStatusChange, logUserDeletion } from '../../lib/audit-logger.js';
import {
  preventSelfDemotion,
  validateBody,
  validateQuery,
  withAdminRole,
  withAuth,
  withCORS,
  withErrorHandling,
  withSelfOrAdmin,
  type AuthenticatedRequest,
} from '../../lib/middleware/index.js';
import prisma from '../../lib/prisma.js';
import { updateUserSchema, userIdSchema } from '../../lib/schemas/user.js';

// GET /api/users/[id] - Get user by ID (self or admin)
const getUserHandler = withCORS(
  withErrorHandling(
    withAuth(
      withSelfOrAdmin((req) => req.query.id as string)(
        validateQuery(userIdSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            const userId = Number(req.query.id);
            await handleGetUser(req, res, userId);
          }
        )
      )
    )
  )
);

// PUT /api/users/[id] - Update user (self or admin, with admin protections)
const updateUserHandler = withCORS(
  withErrorHandling(
    withAuth(
      withSelfOrAdmin((req) => req.query.id as string)(
        preventSelfDemotion(
          validateQuery(userIdSchema)(
            validateBody(updateUserSchema)(
              async (req: AuthenticatedRequest, res: VercelResponse) => {
                const userId = Number(req.query.id);
                await handleUpdateUser(req, res, userId);
              }
            )
          )
        )
      )
    )
  )
);

// DELETE /api/users/[id] - Soft delete user (admin only, cannot delete self)
const deleteUserHandler = withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        validateQuery(userIdSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            const userId = Number(req.query.id);
            
            // Prevent admin from deleting themselves
            if (req.user.id === userId) {
              return res.status(400).json({
                error: 'Self-deletion prevented',
                message: 'Administrators cannot delete their own account'
              });
            }
            
            await handleDeleteUser(req, res, userId);
          }
        )
      )
    )
  )
);

// POST /api/users/[id] - Restore user or Delete user (admin only)
const restoreUserHandler = withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        validateQuery(userIdSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            const userId = Number(req.query.id);
            const { action } = req.body;
            
            if (action === 'restore') {
              await handleRestoreUser(req, res, userId);
            } else if (action === 'delete') {
              // Prevent admin from deleting themselves
              if (req.user.id === userId) {
                return res.status(400).json({
                  error: 'Self-deletion prevented',
                  message: 'Administrators cannot delete their own account'
                });
              }
              await handleDeleteUser(req, res, userId);
            } else {
              return res.status(400).json({ error: 'Invalid action' });
            }
          }
        )
      )
    )
  )
);

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    await getUserHandler(req, res);
  } else if (req.method === 'PUT') {
    await updateUserHandler(req, res);
  } else if (req.method === 'DELETE') {
    await deleteUserHandler(req, res);
  } else if (req.method === 'POST') {
    await restoreUserHandler(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
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
      deletedAt: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ data: user });
}

async function handleUpdateUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
  // Body is already validated by middleware, auth/permissions already checked
  const { name, email, roles, isActive } = req.body;
  
  const isAdmin = req.user.roles.includes('admin');
  
  // Find user
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Build update data
  const updateData: any = { updatedAt: new Date() };

  // Handle field updates
  if (name !== undefined) {
    updateData.name = name;
  }

  if (email !== undefined) {
    // Email updates only allowed for admins (handled by validation middleware)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can update email addresses' });
    }
    updateData.email = email;
  }

  // Note: Password updates are handled separately via dedicated password change endpoints

  if (roles !== undefined) {
    // Role updates only allowed for admins (handled by validation middleware)  
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can update user roles' });
    }
    
    // Log role change for audit
    if (JSON.stringify(existingUser.roles) !== JSON.stringify(roles)) {
      await logRoleChange(req, userId, existingUser.roles, roles);
    }
    updateData.roles = roles;
  }

  if (isActive !== undefined) {
    // Status updates only allowed for admins
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can update user status' });
    }
    
    // Log status change for audit
    if (existingUser.isActive !== isActive) {
      await logStatusChange(req, userId, existingUser.isActive, isActive);
    }
    updateData.isActive = isActive;
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
      deletedAt: true,
      avatarUrl: true,
    },
  });

  return res.status(200).json({
    message: 'User updated successfully',
    data: updatedUser,
  });
}

async function handleDeleteUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
  // Admin role and self-deletion check already handled by middleware
  
  // Find user
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!existingUser.isActive) {
    return res.status(400).json({ error: 'User is already deleted' });
  }

  // Soft delete (set isActive = false and deletedAt timestamp)
  const deletedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      isActive: false,
      deletedAt: new Date()
    },
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

  // Log user deletion for audit trail
  await logUserDeletion(req, userId, existingUser.email);

  return res.status(200).json({
    message: 'User deleted successfully',
    data: deletedUser,
  });
}

async function handleRestoreUser(req: AuthenticatedRequest, res: VercelResponse, userId: number) {
  // Admin role already checked by middleware
  
  // Find user
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (existingUser.isActive) {
    return res.status(400).json({ error: 'User is already active' });
  }

  // Restore user (set isActive = true and clear deletedAt)
  const restoredUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      isActive: true,
      deletedAt: null,
      updatedAt: new Date()
    },
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

  return res.status(200).json({
    message: 'User restored successfully',
    data: restoredUser,
  });
}
