import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';

export interface AuthenticatedRequest extends VercelRequest {
  user: {
    id: number;
    email: string;
    roles: string[];
    isActive: boolean;
  };
}

export type AuthHandler = (
  req: AuthenticatedRequest,
  res: VercelResponse
) => Promise<void | VercelResponse> | void | VercelResponse;

export type MiddlewareResult = {
  authenticated: boolean;
  user?: AuthenticatedRequest['user'];
  error?: string;
};

export async function verifyToken(token: string): Promise<MiddlewareResult> {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      audience: 'user-management-api',
      issuer: 'user-management-system',
    }) as any;    
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        roles: true,
        isActive: true
      }
    });

    if (!user) {
      return { authenticated: false, error: 'User not found or inactive' };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive
      }
    };
  } catch (error: any) {
    if (error && error.name === 'TokenExpiredError') {
      return { authenticated: false, error: 'Token expired' };
    }
    if (error && error.name === 'JsonWebTokenError') {
      return { authenticated: false, error: 'Invalid token' };
    }
    return { authenticated: false, error: 'Authentication failed' };
  }
}

export function withAuth(handler: AuthHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Extract bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);
    const result = await verifyToken(token);

    if (!result.authenticated) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.error
      });
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = result.user!;
    
    return handler(req as AuthenticatedRequest, res);
  };
}