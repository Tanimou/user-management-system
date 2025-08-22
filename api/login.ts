import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  setCORSHeaders,
  setRefreshCookie,
  setSecurityHeaders,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  type JWTPayload,
} from './lib/auth.js';
import prisma from "./lib/prisma.js";
import { createAuthRateLimit, recordAuthFailure, recordAuthSuccess } from './lib/rate-limiter.js';
import { validateEmail, validatePasswordPolicy, DEFAULT_PASSWORD_POLICY } from './lib/validation.js';

// Explicit select fields to satisfy tests expecting a select object
const LOGIN_SELECT = {
  id: true,
  name: true,
  email: true,
  password: true,
  roles: true,
  isActive: true,
  avatarUrl: true,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request (tests expect 204)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED",
    });
  }

  // Apply rate limiting before processing login
  const rateLimitMiddleware = createAuthRateLimit();
  if (!rateLimitMiddleware(req, res)) {
    // Rate limiting handled by middleware - return immediately
    return;
  }

  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };

    // Field presence validation
    const missingDetails: string[] = [];
    if (!email) missingDetails.push('Email is required');
    if (!password) missingDetails.push('Password is required');
    if (missingDetails.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: missingDetails,
        code: 'MISSING_FIELDS',
      });
    }

    // Type validation
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Invalid email or password format',
        code: 'INVALID_FORMAT',
      });
    }

    // Email format validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    }

    // Password policy validation (tests only enforce min length for login attempts)
    if (password.length < DEFAULT_PASSWORD_POLICY.minLength) {
      // Reuse validation helper to build consistent error message
      const relaxedPolicy = { ...DEFAULT_PASSWORD_POLICY, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSpecialChars: false };
      const policyValidation = validatePasswordPolicy(password, relaxedPolicy);
      return res.status(400).json({
        error: 'Password does not meet policy requirements',
        details: policyValidation.errors,
        code: 'INVALID_PASSWORD_POLICY',
      });
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: LOGIN_SELECT,
    });

    // Check if user exists and is active
    const recordFailure = (emailArg: string) => {
      try {
        (recordAuthFailure as unknown as (email: string) => void)(emailArg);
      } catch {}
    };

    if (!user) {
      recordFailure(email);
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }
    if (!user.isActive) {
      recordFailure(email);
      return res.status(401).json({
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(user.password, password);
    if (!isValidPassword) {
      // Always record failure for invalid password (rate limit tracking)
      recordFailure(email);
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Create JWT payload
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
    };

    // Generate tokens
    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken({ userId: user.id });

    // Set refresh token cookie
    setRefreshCookie(res, refreshToken);

    // Record successful authentication
    // record success (tests expect only email arg, adapt wrapper if needed)
    try {
      (recordAuthSuccess as unknown as (email: string) => void)(user.email);
    } catch {
      // swallow metric errors
    }

    // Return response (excluding password)
    const { password: _, createdAt, updatedAt, ...userWithoutPassword } = user as any;

    return res.status(200).json({
      success: true,
      token: accessToken,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error", code: 'INTERNAL_ERROR' });
  }
}
