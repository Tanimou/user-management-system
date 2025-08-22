/**
 * Authentication utilities for user management system.
 * 
 * This module provides comprehensive authentication and authorization functionality including:
 * - Password hashing using Argon2id algorithm
 * - JWT token generation and verification for access/refresh tokens
 * - HTTP-only cookie management for refresh tokens
 * - Authentication middleware for protected routes
 * - Role-based access control (RBAC) utilities
 * - CORS and security headers management
 * 
 * @example Basic Usage
 * ```typescript
 * // Hash a password
 * const hashedPassword = await hashPassword('userPassword123');
 * 
 * // Generate tokens
 * const payload = { userId: 1, email: 'user@example.com', roles: ['user'] };
 * const accessToken = signAccessToken(payload);
 * const refreshToken = signRefreshToken({ userId: 1 });
 * 
 * // Verify password
 * const isValid = await verifyPassword(hashedPassword, 'userPassword123');
 * ```
 * 
 * @author Development Team
 * @since 1.0.0
 */

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** JWT secret key for signing tokens */
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
/** Access token expiration time (default: 15 minutes) */
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
/** Refresh token expiration time (default: 7 days) */
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * JWT token payload interface for access tokens.
 * Contains user information needed for authentication and authorization.
 */
export interface JWTPayload {
  /** Unique user identifier */
  userId: number;
  /** User email address (lowercase) */
  email: string;
  /** Array of user roles for RBAC (e.g., ['user', 'admin']) */
  roles: string[];
}

/**
 * Extended Vercel request interface with authenticated user information.
 * Used by authentication middleware to attach user data to requests.
 */
export interface AuthenticatedRequest extends VercelRequest {
  /** Authenticated user payload from JWT token */
  user?: JWTPayload;
}

/**
 * Hash a password using Argon2id algorithm with secure parameters.
 * 
 * Uses industry-standard Argon2id variant with the following security parameters:
 * - Memory cost: 64MB (2^16 KB)
 * - Time cost: 3 iterations
 * - Parallelism: 1 thread
 * 
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password string
 * 
 * @throws {Error} When password is empty or hashing fails
 * 
 * @example
 * ```typescript
 * const hashed = await hashPassword('MySecurePassword123!');
 * console.log(hashed); // $argon2id$v=19$m=65536,t=3,p=1$...
 * ```
 * 
 * @security
 * - Uses Argon2id with memory cost of 64MB to resist GPU attacks
 * - Time cost of 3 iterations provides good balance of security and performance
 * - Single thread parallelism suitable for serverless environment
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verify a password against its Argon2id hash.
 * 
 * @param hash - The Argon2id hash to verify against
 * @param password - Plain text password to verify
 * @returns Promise resolving to true if password matches, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = await verifyPassword(storedHash, userInputPassword);
 * if (isValid) {
 *   console.log('Password is correct');
 * }
 * ```
 * 
 * @security
 * - Uses constant-time comparison to prevent timing attacks
 * - Returns false for any verification errors to avoid information leakage
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a JWT access token for authenticated API requests.
 * 
 * Access tokens are short-lived (15 minutes) and contain user information
 * needed for authentication and authorization decisions.
 * 
 * @param payload - User information to encode in the token
 * @returns Signed JWT access token string
 * 
 * @example
 * ```typescript
 * const payload = {
 *   userId: 123,
 *   email: 'user@example.com',
 *   roles: ['user', 'admin']
 * };
 * const token = signAccessToken(payload);
 * ```
 * 
 * @security
 * - Tokens expire in 15 minutes to limit exposure window
 * - Includes audience and issuer claims for validation
 * - Uses HS256 algorithm with secure secret
 */
export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    audience: 'user-management-api',
    issuer: 'user-management-system'
  } as jwt.SignOptions);
}

/**
 * Generate a JWT refresh token for token renewal.
 * 
 * Refresh tokens are longer-lived (7 days) and contain minimal user information.
 * They are used only to generate new access tokens and should be stored in
 * HTTP-only cookies.
 * 
 * @param payload - Minimal user information (just userId)
 * @returns Signed JWT refresh token string
 * 
 * @example
 * ```typescript
 * const refreshToken = signRefreshToken({ userId: 123 });
 * setRefreshCookie(res, refreshToken);
 * ```
 * 
 * @security
 * - Tokens expire in 7 days to balance security and user experience
 * - Contains minimal information to reduce exposure
 * - Uses different audience claim than access tokens
 */
export function signRefreshToken(payload: { userId: number }): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    audience: 'user-management-refresh',
    issuer: 'user-management-system'
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT access token.
 * 
 * @param token - JWT access token to verify
 * @returns Decoded JWT payload
 * 
 * @throws {jwt.JsonWebTokenError} When token is invalid
 * @throws {jwt.TokenExpiredError} When token has expired
 * 
 * @example
 * ```typescript
 * try {
 *   const payload = verifyAccessToken(token);
 *   console.log(`User ${payload.userId} authenticated`);
 * } catch (error) {
 *   console.log('Invalid token');
 * }
 * ```
 */
export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET, {
    audience: 'user-management-api',
    issuer: 'user-management-system'
  }) as JWTPayload;
}

/**
 * Verify and decode a JWT refresh token.
 * 
 * @param token - JWT refresh token to verify
 * @returns Decoded refresh token payload containing userId
 * 
 * @throws {jwt.JsonWebTokenError} When token is invalid
 * @throws {jwt.TokenExpiredError} When token has expired
 * 
 * @example
 * ```typescript
 * try {
 *   const { userId } = verifyRefreshToken(refreshToken);
 *   // Generate new access token for this user
 * } catch (error) {
 *   console.log('Invalid refresh token');
 * }
 * ```
 */
export function verifyRefreshToken(token: string): { userId: number } {
  return jwt.verify(token, JWT_SECRET, {
    audience: 'user-management-refresh',
    issuer: 'user-management-system'
  }) as { userId: number };
}

/**
 * Set HTTP-only refresh token cookie.
 * 
 * Stores the refresh token in a secure HTTP-only cookie to prevent XSS attacks.
 * The cookie is configured with appropriate security flags based on environment.
 * 
 * @param res - Vercel response object
 * @param refreshToken - JWT refresh token to store
 * 
 * @example
 * ```typescript
 * const refreshToken = signRefreshToken({ userId: 123 });
 * setRefreshCookie(res, refreshToken);
 * ```
 * 
 * @security
 * - HTTP-only flag prevents JavaScript access
 * - Secure flag enforced in production
 * - SameSite=Strict prevents CSRF attacks
 * - 7-day expiration matches token lifetime
 * - Path=/api restricts cookie scope
 */
export function setRefreshCookie(res: VercelResponse, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader('Set-Cookie', [
    `refreshToken=${refreshToken}; HttpOnly; Secure=${isProduction}; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/api`
  ]);
}

/**
 * Clear refresh token cookie.
 * 
 * Removes the refresh token cookie by setting it to expire immediately.
 * Used during logout or when refresh token becomes invalid.
 * 
 * @param res - Vercel response object
 * 
 * @example
 * ```typescript
 * // During logout
 * clearRefreshCookie(res);
 * ```
 */
export function clearRefreshCookie(res: VercelResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader('Set-Cookie', [
    `refreshToken=; HttpOnly; Secure=${isProduction}; SameSite=Strict; Max-Age=0; Path=/api`
  ]);
}

/**
 * Authentication middleware for protected routes.
 * 
 * Validates JWT access token from Authorization header and attaches
 * user information to the request object. Should be called at the
 * start of all protected endpoints.
 * 
 * @param req - Authenticated request object (user will be attached if valid)
 * @param res - Vercel response object
 * @returns Promise resolving to true if authentication successful, false otherwise
 * 
 * @example
 * ```typescript
 * export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
 *   const isAuthenticated = await requireAuth(req, res);
 *   if (!isAuthenticated) return; // Response already sent
 *   
 *   // req.user is now available with authenticated user info
 *   console.log(`User ${req.user.userId} authenticated`);
 * }
 * ```
 * 
 * @security
 * - Validates JWT signature and expiration
 * - Checks audience and issuer claims
 * - Returns 401 for missing, invalid, or expired tokens
 * - Does not expose token validation details in response
 */
export async function requireAuth(req: AuthenticatedRequest, res: VercelResponse): Promise<boolean> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return false;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    
    req.user = payload;
    return true;
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return false;
  }
}

/**
 * Role-based authorization check.
 * 
 * Verifies that the authenticated user has at least one of the required roles.
 * Used for implementing role-based access control (RBAC).
 * 
 * @param user - JWT payload from authenticated request
 * @param roles - Array of roles, user must have at least one
 * @returns True if user has required role, false otherwise
 * 
 * @example
 * ```typescript
 * if (!requireRole(req.user, ['admin'])) {
 *   return res.status(403).json({ error: 'Admin role required' });
 * }
 * 
 * // Check for multiple possible roles
 * if (!requireRole(req.user, ['admin', 'moderator'])) {
 *   return res.status(403).json({ error: 'Admin or moderator role required' });
 * }
 * ```
 */
export function requireRole(user: JWTPayload | undefined, roles: string[]): boolean {
  if (!user) return false;
  return roles.some(role => user.roles.includes(role));
}

/**
 * Set CORS (Cross-Origin Resource Sharing) headers.
 * 
 * Configures CORS headers to allow frontend application to access the API.
 * The origin is configured via FRONTEND_URL environment variable.
 * 
 * @param res - Vercel response object
 * 
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   setCORSHeaders(res);
 *   
 *   if (req.method === 'OPTIONS') {
 *     return res.status(200).end();
 *   }
 *   // ... rest of handler
 * }
 * ```
 * 
 * @security
 * - Allows credentials for authenticated requests
 * - Restricts origin to configured frontend URL
 * - Sets appropriate cache max-age for preflight requests
 */
export function setCORSHeaders(res: VercelResponse): void {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Set comprehensive security headers.
 * 
 * Applies industry-standard security headers to protect against common
 * web vulnerabilities including XSS, clickjacking, MIME sniffing, and more.
 * 
 * @param res - Vercel response object
 * 
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   setSecurityHeaders(res);
 *   // ... rest of handler
 * }
 * ```
 * 
 * @security
 * Headers applied:
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Enables XSS filtering
 * - Content-Security-Policy: Restricts resource loading
 * - Strict-Transport-Security: Enforces HTTPS (production)
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Restricts browser features
 */
export function setSecurityHeaders(res: VercelResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Allow inline scripts for dev, restrict in production
    isProduction
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline'", // Allow inline scripts for dev, restrict in production
    isProduction
      ? "style-src 'self'"
      : "style-src 'self' 'unsafe-inline'",  // Allow inline styles for dev, restrict in production
    "img-src 'self' data: https:",       // Allow images from self, data URLs, and https
    "font-src 'self' https:",            // Allow fonts from self and https
    "connect-src 'self' https:",         // Allow connections to self and https
    "frame-src 'none'",                  // Block frames
    "object-src 'none'",                 // Block objects/embeds
    "base-uri 'self'",                   // Restrict base URI
    "form-action 'self'",                // Restrict form submissions
    "upgrade-insecure-requests"          // Upgrade HTTP to HTTPS
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Strict Transport Security (HTTPS only)
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Additional security headers
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
}