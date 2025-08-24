import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
export async function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
            audience: 'user-management-api',
            issuer: 'user-management-system',
        });
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
    }
    catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return { authenticated: false, error: 'Token expired' };
        }
        if (error && error.name === 'JsonWebTokenError') {
            return { authenticated: false, error: 'Invalid token' };
        }
        return { authenticated: false, error: 'Authentication failed' };
    }
}
export function withAuth(handler) {
    return async (req, res) => {
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
        req.user = result.user;
        return handler(req, res);
    };
}
