// In-memory storage for rate limiting
// In production, this should be Redis or another shared store
const rateLimitStore = new Map();
// Default rate limit configurations
const DEFAULT_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
    maxFailures: 3, // 3 failures before exponential backoff
    blockDurationMs: 5 * 60 * 1000 // 5 minutes base block duration
};
const LOGIN_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 login attempts per 15 minutes (more lenient for successful logins)
    maxFailures: 5, // 5 failures before exponential backoff
    blockDurationMs: 10 * 60 * 1000 // 10 minutes base block duration
};
/**
 * Get client identifier (IP address)
 */
function getClientIP(req) {
    // Check various headers for the real IP address
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    if (realIP) {
        return realIP;
    }
    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    // Fallback to connection remote address
    return req.connection?.remoteAddress || 'unknown';
}
/**
 * Clean expired entries from the rate limit store
 */
function cleanExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        // Remove entries that are beyond their window and not currently blocked
        const windowExpired = now - entry.windowStart > DEFAULT_CONFIG.windowMs;
        const blockExpired = !entry.blockedUntil || now > entry.blockedUntil;
        if (windowExpired && blockExpired) {
            rateLimitStore.delete(key);
        }
    }
}
/**
 * Calculate exponential backoff block duration
 */
function calculateBlockDuration(failureCount, baseMs) {
    return baseMs * Math.pow(2, Math.min(failureCount - 1, 5)); // Cap at 2^5 = 32x
}
/**
 * Check and update rate limit for a given key
 */
function checkRateLimit(key, config, isFailure = false) {
    cleanExpiredEntries();
    const now = Date.now();
    let entry = rateLimitStore.get(key);
    // Initialize entry if it doesn't exist
    if (!entry) {
        entry = {
            count: 0,
            windowStart: now,
            failureCount: 0
        };
    }
    // Reset window if expired
    const windowExpired = now - entry.windowStart >= config.windowMs;
    if (windowExpired) {
        entry = {
            count: 0,
            windowStart: now,
            failureCount: entry.failureCount, // Preserve failure count across windows for exponential backoff
            lastFailure: entry.lastFailure,
            blockedUntil: entry.blockedUntil
        };
    }
    // Check if currently blocked due to exponential backoff
    if (entry.blockedUntil && now < entry.blockedUntil) {
        const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.windowStart + config.windowMs,
            blockedUntil: entry.blockedUntil,
            retryAfter
        };
    }
    // If block has expired, reset failure count
    if (entry.blockedUntil && now >= entry.blockedUntil) {
        entry.failureCount = 0;
        entry.blockedUntil = undefined;
    }
    // Increment count
    entry.count++;
    // Handle failures
    if (isFailure) {
        entry.failureCount++;
        entry.lastFailure = now;
        // Check if we should apply exponential backoff
        if (entry.failureCount >= config.maxFailures) {
            const blockDuration = calculateBlockDuration(entry.failureCount, config.blockDurationMs);
            entry.blockedUntil = now + blockDuration;
            rateLimitStore.set(key, entry);
            const retryAfter = Math.ceil(blockDuration / 1000);
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.windowStart + config.windowMs,
                blockedUntil: entry.blockedUntil,
                retryAfter
            };
        }
    }
    else {
        // Successful request - reduce failure count gradually
        if (entry.failureCount > 0) {
            entry.failureCount = Math.max(0, entry.failureCount - 1);
        }
    }
    // Check if exceeded rate limit
    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetTime = entry.windowStart + config.windowMs;
    // Update store
    rateLimitStore.set(key, entry);
    return {
        allowed,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
}
/**
 * Rate limiting middleware for authentication endpoints
 */
export function createAuthRateLimit(config = LOGIN_CONFIG) {
    return (req, res) => {
        const clientIP = getClientIP(req);
        const email = req.body?.email;
        // Create rate limit keys
        const ipKey = `auth:ip:${clientIP}`;
        const emailKey = email ? `auth:email:${email.toLowerCase().trim()}` : null;
        // Check IP-based rate limit
        const ipResult = checkRateLimit(ipKey, config);
        // Check email-based rate limit if email is provided
        let emailResult = null;
        if (emailKey) {
            emailResult = checkRateLimit(emailKey, config);
        }
        // Use the most restrictive result
        const result = emailResult && !emailResult.allowed ? emailResult : ipResult;
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
        if (result.retryAfter) {
            res.setHeader('Retry-After', result.retryAfter.toString());
        }
        if (!result.allowed) {
            let message = 'Too many login attempts';
            if (result.blockedUntil) {
                message = `Account temporarily blocked due to repeated failures. Try again in ${result.retryAfter} seconds.`;
            }
            res.status(429).json({
                error: message,
                code: "RATE_LIMIT_EXCEEDED",
                retryAfter: result.retryAfter
            });
            return false;
        }
        return true;
    };
}
/**
 * Record a failed authentication attempt
 */
export function recordAuthFailure(req, email) {
    const clientIP = getClientIP(req);
    const ipKey = `auth:ip:${clientIP}`;
    checkRateLimit(ipKey, LOGIN_CONFIG, true);
    if (email) {
        const emailKey = `auth:email:${email.toLowerCase().trim()}`;
        checkRateLimit(emailKey, LOGIN_CONFIG, true);
    }
}
/**
 * Record a successful authentication attempt
 */
export function recordAuthSuccess(req, email) {
    const clientIP = getClientIP(req);
    const ipKey = `auth:ip:${clientIP}`;
    const emailKey = `auth:email:${email.toLowerCase().trim()}`;
    checkRateLimit(ipKey, LOGIN_CONFIG, false);
    checkRateLimit(emailKey, LOGIN_CONFIG, false);
}
// Clean up expired entries every 5 minutes
setInterval(cleanExpiredEntries, 5 * 60 * 1000);
