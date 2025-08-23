import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blacklistRefreshToken,
  getBlacklistStats,
  isTokenBlacklisted,
  protectConcurrentRefresh,
  resetBlacklist,
} from '../lib/token-blacklist';

// Mock crypto for consistent hashing
vi.mock('crypto', () => ({
  createHash: () => ({
    update: () => ({
      digest: () => ({
        substring: () => 'mock-token-id',
      }),
    }),
  }),
}));

describe('Token Blacklist', () => {
  beforeEach(() => {
    // Clear any existing blacklist entries
    vi.clearAllMocks();
    resetBlacklist();

    // Ensure clean state for stats
    const stats = getBlacklistStats();
    if (stats.totalEntries > 0) {
      console.warn(`Blacklist not properly reset: ${stats.totalEntries} entries remaining`);
    }
  });

  describe('blacklistRefreshToken', () => {
    it('should blacklist a token successfully', () => {
      const token = 'test-token';
      const userId = 1;
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      blacklistRefreshToken(token, userId, expiresAt);

      expect(isTokenBlacklisted(token)).toBe(true);
    });

    it('should store expiration time correctly', () => {
      const token = 'test-token-2';
      const userId = 1;
      const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago (expired)

      blacklistRefreshToken(token, userId, expiresAt);

      // Token should not be considered blacklisted if expired
      expect(isTokenBlacklisted(token)).toBe(false);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for non-blacklisted token', () => {
      const token = 'non-blacklisted-token';

      expect(isTokenBlacklisted(token)).toBe(false);
    });

    it('should return true for blacklisted active token', () => {
      const token = 'blacklisted-token';
      const userId = 1;
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // Future expiration

      blacklistRefreshToken(token, userId, expiresAt);

      expect(isTokenBlacklisted(token)).toBe(true);
    });

    it('should return false for blacklisted but expired token', () => {
      const token = 'expired-blacklisted-token';
      const userId = 1;
      const expiresAt = Math.floor(Date.now() / 1000) - 1; // Past expiration

      blacklistRefreshToken(token, userId, expiresAt);

      expect(isTokenBlacklisted(token)).toBe(false);
    });

    it('should clean up expired entries when checking', () => {
      const token1 = 'expired-token';
      const token2 = 'active-token';
      const userId = 1;
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      blacklistRefreshToken(token1, userId, pastTime);
      blacklistRefreshToken(token2, userId, futureTime);

      // First check should clean up expired entry
      expect(isTokenBlacklisted(token1)).toBe(false);
      expect(isTokenBlacklisted(token2)).toBe(true);
    });
  });

  describe('protectConcurrentRefresh', () => {
    it('should execute function when no concurrent refresh exists', async () => {
      const userId = 1;
      const mockFunction = vi.fn().mockResolvedValue('result');

      const result = await protectConcurrentRefresh(userId, mockFunction);

      expect(mockFunction).toHaveBeenCalledOnce();
      expect(result).toBe('result');
    });

    it('should return existing promise for concurrent requests', async () => {
      const userId = 1;

      // Create a deferred promise that we can control
      let resolveFirst: (value: string) => void;
      const firstPromise = new Promise<string>(resolve => {
        resolveFirst = resolve;
      });

      const firstFunction = vi.fn().mockImplementation(() => firstPromise);
      const secondFunction = vi.fn().mockResolvedValue('second-result');

      // Start first refresh
      const firstRefresh = protectConcurrentRefresh(userId, firstFunction);

      // Start second refresh while first is pending
      const secondRefresh = protectConcurrentRefresh(userId, secondFunction);

      // Second function should not be called because first is still pending
      expect(secondFunction).not.toHaveBeenCalled();

      // Resolve first promise
      resolveFirst!('first-result');

      // Both should resolve to the same result from the first function
      const [firstResult, secondResult] = await Promise.all([firstRefresh, secondRefresh]);

      expect(firstResult).toBe('first-result');
      expect(secondResult).toBe('first-result');
      expect(firstFunction).toHaveBeenCalledOnce();
      expect(secondFunction).not.toHaveBeenCalled();
    });

    it('should allow new refresh after previous completes', async () => {
      const userId = 1;
      const firstFunction = vi.fn().mockImplementation(() => Promise.resolve('first-result'));
      const secondFunction = vi.fn().mockImplementation(() => Promise.resolve('second-result'));

      // First refresh
      const firstResult = await protectConcurrentRefresh(userId, firstFunction);

      // Second refresh after first completes
      const secondResult = await protectConcurrentRefresh(userId, secondFunction);

      expect(firstResult).toBe('first-result');
      expect(secondResult).toBe('second-result');
      expect(firstFunction).toHaveBeenCalledOnce();
      expect(secondFunction).toHaveBeenCalledOnce();
    });

    it('should handle different users independently', async () => {
      const userId1 = 1;
      const userId2 = 2;
      const function1 = vi.fn().mockImplementation(() => Promise.resolve('result1'));
      const function2 = vi.fn().mockImplementation(() => Promise.resolve('result2'));

      const [result1, result2] = await Promise.all([
        protectConcurrentRefresh(userId1, function1),
        protectConcurrentRefresh(userId2, function2),
      ]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(function1).toHaveBeenCalledOnce();
      expect(function2).toHaveBeenCalledOnce();
    });

    it('should clean up after function throws error', async () => {
      const userId = 1;
      const errorFunction = vi
        .fn()
        .mockImplementation(() => Promise.reject(new Error('Test error')));
      const successFunction = vi.fn().mockImplementation(() => Promise.resolve('success'));

      // First function throws error
      await expect(protectConcurrentRefresh(userId, errorFunction)).rejects.toThrow('Test error');

      // Second function should be allowed to run
      const result = await protectConcurrentRefresh(userId, successFunction);

      expect(result).toBe('success');
      expect(errorFunction).toHaveBeenCalledOnce();
      expect(successFunction).toHaveBeenCalledOnce();
    });
  });

  describe('getBlacklistStats', () => {
    it('should return correct statistics', () => {
      const userId = 1;
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const pastTime = Math.floor(Date.now() / 1000) - 3600;

      // Add some entries
      blacklistRefreshToken('active-token-1', userId, futureTime);
      blacklistRefreshToken('active-token-2', userId, futureTime);
      blacklistRefreshToken('expired-token', userId, pastTime);

      const stats = getBlacklistStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.activeEntries).toBe(2);
    });

    it('should return zero stats when blacklist is empty', () => {
      const stats = getBlacklistStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.activeEntries).toBe(0);
    });
  });
});
