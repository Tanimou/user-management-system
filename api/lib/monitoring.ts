// lib/monitoring.ts
import type { VercelRequest } from '@vercel/node';

export function logRequest(req: VercelRequest) {
  const logData = {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
    timestamp: new Date().toISOString()
  };
  
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logData));
  }
}

export function logError(error: Error, context: any = {}) {
  const errorLog = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context,
    timestamp: new Date().toISOString()
  };
  
  console.error(JSON.stringify(errorLog));
  
  // Send to external monitoring service
  if (process.env.SENTRY_DSN) {
    // Sentry.captureException(error, context);
  }
}