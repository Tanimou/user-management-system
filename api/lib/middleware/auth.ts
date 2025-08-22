import type { VercelResponse } from '@vercel/node';
import { requireAuth, requireRole, type AuthenticatedRequest, type JWTPayload } from '../auth.js';

/**
 * Authentication middleware for Vercel serverless functions
 * Validates JWT tokens and adds user data to request
 */
export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<boolean> {
  return requireAuth(req, res);
}

/**
 * Authorization middleware for role-based access control
 * Checks if authenticated user has required roles
 */
export function authorizeRoles(user: JWTPayload | undefined, allowedRoles: string[]): boolean {
  return requireRole(user, allowedRoles);
}

/**
 * Combined authentication and authorization middleware
 * Authenticates the request and checks for required roles
 */
export async function requireAuthAndRoles(
  req: AuthenticatedRequest,
  res: VercelResponse,
  allowedRoles: string[] = ['user']
): Promise<boolean> {
  // First authenticate the request
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return false;
  }

  // Then check if user has required roles
  if (!authorizeRoles(req.user, allowedRoles)) {
    res.status(403).json({
      error: 'Insufficient permissions. Required roles: ' + allowedRoles.join(', '),
    });
    return false;
  }

  return true;
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<boolean> {
  return requireAuthAndRoles(req, res, ['admin']);
}

/**
 * Middleware to allow both admin and user roles (any authenticated user)
 */
export async function requireUser(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<boolean> {
  return requireAuthAndRoles(req, res, ['user', 'admin']);
}

// Export types for convenience
export type { AuthenticatedRequest, JWTPayload };
