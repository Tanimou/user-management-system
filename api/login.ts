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
import { validatePasswordPolicy } from './lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Apply rate limiting before processing login
  const rateLimitMiddleware = createAuthRateLimit();
  if (!rateLimitMiddleware(req, res)) {
    return; // Rate limit exceeded, response already sent
  }

  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid email or password format" });
    }

    // Validate password policy (enhanced validation)
    const policyValidation = validatePasswordPolicy(password);
    if (!policyValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet policy requirements',
        details: policyValidation.errors,
        code: 'INVALID_PASSWORD_POLICY'
      });
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        avatarUrl: true,
      },
    });

    // Check if user exists and is active
    if (!user || !user.isActive) {
      recordAuthFailure(req, email);
      return res.status(401).json({ 
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(user.password, password);
    if (!isValidPassword) {
      recordAuthFailure(req, email);
      return res.status(401).json({ 
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
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
    recordAuthSuccess(req, user.email);

    // Return response (excluding password)
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      token: accessToken,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
