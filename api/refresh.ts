import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from './lib/prisma.js';
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  setCORSHeaders,
  setSecurityHeaders,
  type JWTPayload
} from './lib/auth.js';
import { createAuthRateLimit } from './lib/rate-limiter.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting for refresh requests (more lenient than login)
  const rateLimitMiddleware = createAuthRateLimit({
    windowMs: 15 * 60 * 1000,    // 15 minutes
    maxRequests: 50,             // 50 refresh attempts per 15 minutes
    maxFailures: 20,             // 20 failures before backoff
    blockDurationMs: 60 * 1000   // 1 minute base block duration
  });
  if (!rateLimitMiddleware(req, res)) {
    return; // Rate limit exceeded, response already sent
  }

  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    // Verify refresh token
    let payload: { userId: number };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Find user and verify they're still active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Create new JWT payload
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles
    };

    // Generate new tokens (rotate refresh token)
    const newAccessToken = signAccessToken(jwtPayload);
    const newRefreshToken = signRefreshToken({ userId: user.id });

    // Set new refresh token cookie
    setRefreshCookie(res, newRefreshToken);

    // Return response
    return res.status(200).json({
      message: 'Token refreshed successfully',
      user,
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    clearRefreshCookie(res);
    return res.status(500).json({ error: 'Internal server error' });
  }
}