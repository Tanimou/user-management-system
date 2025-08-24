/**
 * Refresh Token Blacklist Manager
 *
 * Manages blacklisted refresh tokens to prevent replay attacks
 * and ensure single-use principle for refresh tokens.
 */
// In-memory blacklist store
// In production, this should be replaced with Redis or database storage
const blacklist = new Map();
// Concurrent refresh protection
const refreshInProgress = new Map();
/**
 * Generate a unique token ID from JWT token
 */
function extractTokenId(token) {
    // For JWTs, we can use a hash of the token as the ID
    // This ensures uniqueness without storing the full token
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
}
/**
 * Add a refresh token to the blacklist
 */
export function blacklistRefreshToken(token, userId, expiresAt) {
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
export function isTokenBlacklisted(token) {
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
function cleanExpiredEntries() {
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
export function protectConcurrentRefresh(userId, refreshFunction) {
    // Check if refresh is already in progress for this user
    const existingRefresh = refreshInProgress.get(userId);
    if (existingRefresh) {
        return existingRefresh;
    }
    // Start new refresh and store the promise
    const refreshPromise = refreshFunction()
        .finally(() => {
        // Clean up after completion
        refreshInProgress.delete(userId);
    });
    refreshInProgress.set(userId, refreshPromise);
    return refreshPromise;
}
/**
 * Get blacklist statistics (for monitoring)
 */
export function getBlacklistStats() {
    const now = Date.now();
    let activeEntries = 0;
    for (const entry of blacklist.values()) {
        if (now <= entry.expiresAt) {
            activeEntries++;
        }
    }
    return {
        totalEntries: blacklist.size,
        activeEntries,
    };
}
/**
 * Reset blacklist state (for testing)
 */
export function resetBlacklist() {
    blacklist.clear();
    refreshInProgress.clear();
}
// Clean expired entries every 5 minutes
setInterval(cleanExpiredEntries, 5 * 60 * 1000);
