import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: number;
  email: string;
  roles: string[];
}

export interface AuthenticatedRequest extends VercelRequest {
  user?: JWTPayload;
}

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

// JWT utilities
export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    audience: 'user-management-api',
    issuer: 'user-management-system'
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: { userId: number }): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    audience: 'user-management-refresh',
    issuer: 'user-management-system'
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET, {
    audience: 'user-management-api',
    issuer: 'user-management-system'
  }) as JWTPayload;
}

export function verifyRefreshToken(token: string): { userId: number } {
  return jwt.verify(token, JWT_SECRET, {
    audience: 'user-management-refresh',
    issuer: 'user-management-system'
  }) as { userId: number };
}

// Cookie utilities
export function setRefreshCookie(res: VercelResponse, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader('Set-Cookie', [
    `refreshToken=${refreshToken}; HttpOnly; Secure=${isProduction}; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/api`
  ]);
}

export function clearRefreshCookie(res: VercelResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader('Set-Cookie', [
    `refreshToken=; HttpOnly; Secure=${isProduction}; SameSite=Strict; Max-Age=0; Path=/api`
  ]);
}

// Authentication middleware
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

// Role-based authorization
export function requireRole(user: JWTPayload | undefined, roles: string[]): boolean {
  if (!user) return false;
  return roles.some(role => user.roles.includes(role));
}

// CORS helper
export function setCORSHeaders(res: VercelResponse): void {
  const frontendUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Security headers
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