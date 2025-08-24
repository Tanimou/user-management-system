/**
 * Audit logging utilities for tracking user management operations
 */

import prisma from './prisma.js';
import type { AuthenticatedRequest } from './middleware/enhanced-auth.js';

/**
 * Log role change events for audit trail
 */
export async function logRoleChange(
  req: AuthenticatedRequest,
  targetUserId: number,
  oldRoles: string[],
  newRoles: string[]
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: 'ROLE_UPDATE',
        entity: 'User',
        entityId: targetUserId,
        payload: {
          oldRoles,
          newRoles,
          changes: getRoleChanges(oldRoles, newRoles),
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'] || null
        }
      }
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Failed to log role change:', error);
  }
}

/**
 * Log user status change events
 */
export async function logStatusChange(
  req: AuthenticatedRequest,
  targetUserId: number,
  oldStatus: boolean,
  newStatus: boolean
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity: 'User',
        entityId: targetUserId,
        payload: {
          oldStatus,
          newStatus,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'] || null
        }
      }
    });
  } catch (error) {
    console.error('Failed to log status change:', error);
  }
}

/**
 * Log user creation events
 */
export async function logUserCreation(
  req: AuthenticatedRequest,
  newUserId: number,
  userData: any
): Promise<void> {
  try {
    const sanitizedData = { ...userData };
    delete sanitizedData.password; // Never log passwords
    
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: newUserId,
        payload: {
          userData: sanitizedData,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'] || null
        }
      }
    });
  } catch (error) {
    console.error('Failed to log user creation:', error);
  }
}

/**
 * Log user deletion events
 */
export async function logUserDeletion(
  req: AuthenticatedRequest,
  targetUserId: number,
  userEmail: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: 'USER_DELETED',
        entity: 'User',
        entityId: targetUserId,
        payload: {
          userEmail,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'] || null
        }
      }
    });
  } catch (error) {
    console.error('Failed to log user deletion:', error);
  }
}

/**
 * Helper function to get role changes
 */
function getRoleChanges(oldRoles: string[], newRoles: string[]) {
  const added = newRoles.filter(role => !oldRoles.includes(role));
  const removed = oldRoles.filter(role => !newRoles.includes(role));
  
  return {
    added,
    removed,
    hasChanges: added.length > 0 || removed.length > 0
  };
}

/**
 * Helper function to extract client IP
 */
function getClientIP(req: any): string {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}