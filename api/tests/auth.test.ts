import { beforeAll, describe, expect, it } from 'vitest';
import {
  hashPassword,
  requireRole,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
  type JWTPayload,
} from '../lib/auth';

// Mock environment variables for testing
beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
});

describe('Password Hashing', () => {
  it('should hash and verify password correctly', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, 'wrongPassword')).toBe(false);
  });

  it('should return false for invalid hash', async () => {
    const result = await verifyPassword('invalid-hash', 'password');
    expect(result).toBe(false);
  });
});

describe('JWT Token Management', () => {
  const mockPayload: JWTPayload = {
    userId: 1,
    email: 'test@example.com',
    roles: ['user'],
  };

  const mockRefreshPayload = { userId: 1 };

  it('should sign and verify access token', () => {
    const token = signAccessToken(mockPayload);
    expect(token).toBeTruthy();

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.email).toBe(mockPayload.email);
    expect(decoded.roles).toEqual(mockPayload.roles);
  });

  it('should sign and verify refresh token', () => {
    const token = signRefreshToken(mockRefreshPayload);
    expect(token).toBeTruthy();

    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(mockRefreshPayload.userId);
  });

  it('should throw error for invalid access token', () => {
    expect(() => verifyAccessToken('invalid-token')).toThrow();
  });

  it('should throw error for invalid refresh token', () => {
    expect(() => verifyRefreshToken('invalid-token')).toThrow();
  });
});

describe('Role-based Authorization', () => {
  const adminUser: JWTPayload = {
    userId: 1,
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  };

  const regularUser: JWTPayload = {
    userId: 2,
    email: 'user@example.com',
    roles: ['user'],
  };

  it('should allow admin role access', () => {
    expect(requireRole(adminUser, ['admin'])).toBe(true);
    expect(requireRole(adminUser, ['user'])).toBe(true);
    expect(requireRole(adminUser, ['user', 'admin'])).toBe(true);
  });

  it('should restrict regular user from admin role', () => {
    expect(requireRole(regularUser, ['admin'])).toBe(false);
    expect(requireRole(regularUser, ['user'])).toBe(true);
  });

  it('should return false for undefined user', () => {
    expect(requireRole(undefined, ['user'])).toBe(false);
    expect(requireRole(undefined, ['admin'])).toBe(false);
  });

  it('should handle multiple required roles', () => {
    expect(requireRole(adminUser, ['admin', 'moderator'])).toBe(true); // Has admin
    expect(requireRole(regularUser, ['admin', 'moderator'])).toBe(false); // Has neither
  });
});
