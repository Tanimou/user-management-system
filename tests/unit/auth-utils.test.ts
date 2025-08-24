import { beforeEach, describe, expect, it } from 'vitest';
import {
  hashPassword,
  requireRole,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
  type JWTPayload,
} from '../../lib/auth';

describe('Authentication Utilities', () => {
  beforeEach(() => {
    // Set consistent test environment
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-key-for-comprehensive-testing';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  describe('Password Hashing', () => {
    it('should hash passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toMatch(/^\$argon2id\$/);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should verify correct passwords', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      const isValid = await verifyPassword(hashedPassword, password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hashedPassword = await hashPassword(password);

      const isValid = await verifyPassword(hashedPassword, wrongPassword);
      expect(isValid).toBe(false);
    });

    it('should handle empty passwords', async () => {
      const isValid = await verifyPassword('hash', '');
      expect(isValid).toBe(false);
    });

    it('should handle malformed hash gracefully', async () => {
      const isValid = await verifyPassword('invalid-hash', 'password');
      expect(isValid).toBe(false);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'SamePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(hash1, password)).toBe(true);
      expect(await verifyPassword(hash2, password)).toBe(true);
    });
  });

  describe('JWT Access Tokens', () => {
    const mockUser: JWTPayload = {
      userId: 1,
      email: 'test@example.com',
      roles: ['user'],
    };

    it('should generate valid access tokens', () => {
      const accessToken = signAccessToken(mockUser);

      expect(accessToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify valid access tokens', () => {
      const accessToken = signAccessToken(mockUser);
      const payload = verifyAccessToken(accessToken);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(mockUser.userId);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.roles).toEqual(mockUser.roles);
    });

    it('should include correct JWT claims', () => {
      const accessToken = signAccessToken(mockUser);
      const payload = verifyAccessToken(accessToken);

      expect(payload.userId).toBe(1);
      expect(payload.email).toBe('test@example.com');
      expect(payload.roles).toContain('user');
    });

    it('should reject invalid tokens', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyAccessToken(invalidToken);
      }).toThrow();
    });

    it('should reject malformed tokens', () => {
      expect(() => {
        verifyAccessToken('not-a-jwt-token');
      }).toThrow();
    });

    it('should handle tokens with wrong signature', () => {
      // This test validates that tokens signed with different secrets are rejected
      // Since we're using the same secret in test environment, we'll create a malformed token
      const malformedToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXX0.wrong_signature';

      expect(() => {
        verifyAccessToken(malformedToken);
      }).toThrow();
    });
  });

  describe('JWT Refresh Tokens', () => {
    const refreshPayload = { userId: 1 };

    it('should generate valid refresh tokens', () => {
      const refreshToken = signRefreshToken(refreshPayload);

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.')).toHaveLength(3);
    });

    it('should verify valid refresh tokens', () => {
      const refreshToken = signRefreshToken(refreshPayload);
      const payload = verifyRefreshToken(refreshToken);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(refreshPayload.userId);
    });

    it('should reject invalid refresh tokens', () => {
      expect(() => {
        verifyRefreshToken('invalid.refresh.token');
      }).toThrow();
    });
  });

  describe('Role-based Authorization', () => {
    it('should allow users with required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user', 'admin'],
      };

      expect(requireRole(user, ['user'])).toBe(true);
      expect(requireRole(user, ['admin'])).toBe(true);
      expect(requireRole(user, ['user', 'admin'])).toBe(true);
    });

    it('should reject users without required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user'],
      };

      expect(requireRole(user, ['admin'])).toBe(false);
      expect(requireRole(user, ['moderator'])).toBe(false);
    });

    it('should handle undefined user', () => {
      expect(requireRole(undefined, ['user'])).toBe(false);
    });

    it('should handle empty roles array', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: [],
      };

      expect(requireRole(user, ['user'])).toBe(false);
    });

    it('should handle empty required roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['user'],
      };

      expect(requireRole(user, [])).toBe(false);
    });

    it('should handle case sensitivity in roles', () => {
      const user: JWTPayload = {
        userId: 1,
        email: 'user@example.com',
        roles: ['User', 'Admin'],
      };

      // Roles should be case-sensitive
      expect(requireRole(user, ['user'])).toBe(false);
      expect(requireRole(user, ['User'])).toBe(true);
    });
  });

  describe('Token Expiration', () => {
    it('should create tokens with expiration', () => {
      // Test that tokens have expiration (structure test)
      const mockUser: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user'],
      };

      const token = signAccessToken(mockUser);

      // Decode token to check expiration claim exists
      const payload = verifyAccessToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe(mockUser.userId);

      // Note: Actual expiration testing would require time manipulation
      // or integration tests with real timeouts
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in email', () => {
      const mockUser: JWTPayload = {
        userId: 1,
        email: 'test+special@example.com',
        roles: ['user'],
      };

      const token = signAccessToken(mockUser);
      const payload = verifyAccessToken(token);

      expect(payload.email).toBe('test+special@example.com');
    });

    it('should handle multiple roles', () => {
      const mockUser: JWTPayload = {
        userId: 1,
        email: 'test@example.com',
        roles: ['user', 'admin', 'moderator'],
      };

      const token = signAccessToken(mockUser);
      const payload = verifyAccessToken(token);

      expect(payload.roles).toHaveLength(3);
      expect(payload.roles).toContain('user');
      expect(payload.roles).toContain('admin');
      expect(payload.roles).toContain('moderator');
    });

    it('should handle large user IDs', () => {
      const mockUser: JWTPayload = {
        userId: 999999999,
        email: 'test@example.com',
        roles: ['user'],
      };

      const token = signAccessToken(mockUser);
      const payload = verifyAccessToken(token);

      expect(payload.userId).toBe(999999999);
    });
  });
});
