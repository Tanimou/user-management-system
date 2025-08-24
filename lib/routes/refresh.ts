import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearRefreshCookie,
  setCORSHeaders,
  setRefreshCookie,
  setSecurityHeaders,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JWTPayload,
} from '../auth.js';
import prisma, { USER_SELECT_FIELDS } from '../prisma.js';
import { createAuthRateLimit } from '../rate-limiter.js';
import {
  blacklistRefreshToken,
  isTokenBlacklisted,
  protectConcurrentRefresh,
} from '../token-blacklist.js';

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
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // 50 refresh attempts per 15 minutes
    maxFailures: 20, // 20 failures before backoff
    blockDurationMs: 60 * 1000, // 1 minute base block duration
  });
  if (!rateLimitMiddleware(req, res)) {
    return; // Rate limit exceeded, response already sent
  }

  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'No refresh token provided',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    // Check if token is blacklisted (used previously)
    if (isTokenBlacklisted(refreshToken)) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: 'Refresh token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    // Verify refresh token
    let payload: { userId: number; exp?: number };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Use concurrent refresh protection
    const result = await protectConcurrentRefresh(payload.userId, async () => {
      // Find user and verify they're still active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: USER_SELECT_FIELDS,
      });

      if (!user || !user.isActive) {
        clearRefreshCookie(res);
        throw new Error('USER_NOT_FOUND');
      }

      // Blacklist the current refresh token (single-use principle)
      const expirationTime = payload.exp || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days fallback
      blacklistRefreshToken(refreshToken, payload.userId, expirationTime);

      // Create new JWT payload with latest user data
      const jwtPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        roles: user.roles,
      };

      // Generate new tokens (rotate refresh token)
      const newAccessToken = signAccessToken(jwtPayload);
      const newRefreshToken = signRefreshToken({ userId: user.id });

      return {
        user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });

    // Set new refresh token cookie
    setRefreshCookie(res, result.refreshToken);

    // Return response in the format specified by the API spec
    return res.status(200).json({
      token: result.accessToken,
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    clearRefreshCookie(res);

    // Handle specific errors
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}
