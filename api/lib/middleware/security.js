export function corsHeaders(allowedOrigin) {
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400' // 24 hours
    };
}
export function securityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'"
    };
}
export function withCORS(handler) {
    return async (req, res) => {
        const allowedOrigin = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
        // Set CORS headers
        Object.entries(corsHeaders(allowedOrigin)).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        // Set security headers
        Object.entries(securityHeaders()).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        return handler(req, res);
    };
}
