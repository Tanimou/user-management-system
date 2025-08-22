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
import prisma, { USER_AUTH_SELECT_FIELDS } from "./lib/prisma.js";
import { createAuthRateLimit, recordAuthFailure, recordAuthSuccess } from './lib/rate-limiter.js';
import { validatePasswordPolicy } from './lib/validation.js';
import { logger } from './lib/logger.js';
import { withRequestLogging } from './lib/middleware/logging.js';
import { errorTracker } from './lib/error-tracking.js';
import { withDatabaseMonitoring } from './lib/performance-monitoring.js';
import { businessMetrics } from './lib/business-metrics.js';
import { securityMonitor, SecurityEventType } from './lib/security-monitor.js';

const loginHandler = async (req: VercelRequest, res: VercelResponse) => {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== "POST") {
    logger.warn('Invalid method for login', { method: req.method });
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Apply rate limiting before processing login
  const rateLimitMiddleware = createAuthRateLimit();
  if (!rateLimitMiddleware(req, res)) {
    return; // Rate limit exceeded, response already sent
  }

  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const userAgent = req.headers['user-agent'];

  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      logger.security('Login attempt with missing credentials', {
        ip: clientIP,
        userAgent,
        missingField: !email ? 'email' : 'password'
      });
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof email !== "string" || typeof password !== "string") {
      logger.security('Login attempt with invalid data types', {
        ip: clientIP,
        userAgent,
        emailType: typeof email,
        passwordType: typeof password
      });
      return res
        .status(400)
        .json({ error: "Invalid email or password format" });
    }

    // Validate password policy (enhanced validation)
    const policyValidation = validatePasswordPolicy(password);
    if (!policyValidation.isValid) {
      logger.security('Login failed due to password policy violation', {
        email: email.toLowerCase(),
        ip: clientIP,
        userAgent,
        policyErrors: policyValidation.errors
      });
      return res.status(400).json({ 
        error: 'Password does not meet policy requirements',
        details: policyValidation.errors,
        code: 'INVALID_PASSWORD_POLICY'
      });
    }

    // Find user by email (case-insensitive) with monitoring
    const user = await withDatabaseMonitoring('user_lookup', 
      prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: USER_AUTH_SELECT_FIELDS,
      })
    );

    // Check if user exists and is active
    if (!user || !user.isActive) {
      recordAuthFailure(req, email);
      
      // Track security event
      securityMonitor.recordSecurityEvent(
        SecurityEventType.FAILED_LOGIN,
        'login_endpoint',
        { 
          reason: !user ? 'user_not_found' : 'user_inactive',
          email: email.toLowerCase()
        },
        {
          email: email.toLowerCase(),
          ip: clientIP,
          userAgent
        }
      );
      
      logger.security('Login failed - invalid credentials', {
        email: email.toLowerCase(),
        ip: clientIP,
        userAgent,
        reason: !user ? 'user_not_found' : 'user_inactive'
      });
      return res.status(401).json({ 
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(user.password, password);
    if (!isValidPassword) {
      recordAuthFailure(req, email);
      
      // Track failed login for security monitoring
      securityMonitor.recordSecurityEvent(
        SecurityEventType.FAILED_LOGIN,
        'login_endpoint',
        { 
          reason: 'invalid_password',
          email: user.email
        },
        {
          userId: user.id,
          email: user.email,
          ip: clientIP,
          userAgent
        }
      );
      
      logger.security('Login failed - invalid password', {
        userId: user.id,
        email: user.email,
        ip: clientIP,
        userAgent
      });
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
    
    // Track successful login in business metrics
    businessMetrics.trackUserLogin(user.id, true, 'password', {
      userId: user.id,
      email: user.email,
      ip: clientIP,
      userAgent
    });
    
    // Check for unusual activity
    securityMonitor.detectUnusualActivity(user.id, {
      userId: user.id,
      email: user.email,
      ip: clientIP,
      userAgent
    });
    
    // Log successful login
    logger.business('User login successful', {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      ip: clientIP,
      userAgent
    });

    // Return response (excluding password)
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      token: accessToken,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    errorTracker.trackError(error, {
      action: 'user_login',
      email: req.body?.email,
      ip: clientIP,
      userAgent
    });
    
    logger.error("Login error", error, {
      email: req.body?.email,
      ip: clientIP,
      userAgent
    });
    
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default withRequestLogging(loginHandler);
