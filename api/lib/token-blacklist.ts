/**
 * Refresh Token Blacklist Manager
 * 
 * Manages blacklisted refresh tokens to prevent replay attacks
 * and ensure single-use principle for refresh tokens.
 */

interface BlacklistEntry {
  tokenId: string;
  userId: number;
  blacklistedAt: number;
  expiresAt: number;
}

// In-memory blacklist store
// In production, this should be replaced with Redis or database storage
const blacklist = new Map<string, BlacklistEntry>();

// Concurrent refresh protection
const refreshInProgress = new Map<number, Promise<any>>();

/**
 * Generate a unique token ID from JWT token
 */
function extractTokenId(token: string): string {
  // For JWTs, we can use a hash of the token as the ID
  // This ensures uniqueness without storing the full token
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
}

/**
 * Add a refresh token to the blacklist
 */
export function blacklistRefreshToken(token: string, userId: number, expiresAt: number): void {
  const tokenId = extractTokenId(token);
  const now = Date.now();
  
  blacklist.set(tokenId, {
    tokenId,
    userId,
    blacklistedAt: now,
    expiresAt: expiresAt * 1000, // Convert to milliseconds
  });
  
  // Clean expired entries periodically
  if (blacklist.size % 100 === 0) {
    cleanExpiredEntries();
  }
}

/**
 * Check if a refresh token is blacklisted
 */
export function isTokenBlacklisted(token: string): boolean {
  const tokenId = extractTokenId(token);
  const entry = blacklist.get(tokenId);
  
  if (!entry) {
    return false;
  }
  
  // Check if the blacklist entry has expired
  if (Date.now() > entry.expiresAt) {
    blacklist.delete(tokenId);
    return false;
  }
  
  return true;
}

/**
 * Clean expired blacklist entries
 */
function cleanExpiredEntries(): void {
  const now = Date.now();
  
  for (const [tokenId, entry] of blacklist.entries()) {
    if (now > entry.expiresAt) {
      blacklist.delete(tokenId);
    }
  }
}

/**
 * Protect against concurrent refresh requests for the same user
 */
export function protectConcurrentRefresh<T>(
  userId: number,
  refreshFunction: () => Promise<T>
): Promise<T> {
  const existing = refreshInProgress.get(userId);
  if (existing) return existing;

  let settle: (value: T) => void;
  let rejecter: (reason?: any) => void;
  const wrapper = new Promise<T>((resolve, reject) => {
    settle = resolve;
    rejecter = reject;
  });

  refreshInProgress.set(userId, wrapper);

  (async () => {
    try {
      const result = await refreshFunction();
      settle!(result);
    } catch (err) {
      rejecter!(err);
    } finally {
      refreshInProgress.delete(userId);
    }
  })();

  return wrapper;
}

/**
 * Get blacklist statistics (for monitoring)
 */
export function getBlacklistStats(): { totalEntries: number; activeEntries: number } {
  cleanExpiredEntries();
  const now = Date.now();
  let active = 0;
  for (const entry of blacklist.values()) {
    if (now <= entry.expiresAt) active++;
  }
  return { totalEntries: blacklist.size, activeEntries: active };
}

/**
 * Reset blacklist state (for testing)
 */
export function resetBlacklist(): void {
  blacklist.clear();
  refreshInProgress.clear();
}

// Clean expired entries every 5 minutes
setInterval(cleanExpiredEntries, 5 * 60 * 1000);