import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';

export interface RequestWithContext extends VercelRequest {
  requestId: string;
  startTime: number;
}

export function withRequestLogging(handler: Function) {
  return async (req: RequestWithContext, res: VercelResponse) => {
    // Generate request ID and start timing
    req.requestId = uuidv4();
    req.startTime = Date.now();

    const context = {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      ip: Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      userAgent: req.headers['user-agent'],
    };

    // Log incoming request
    logger.info('Incoming request', context);

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - req.startTime;
      
      logger.info('Request completed', {
        ...context,
        statusCode: res.statusCode,
        duration,
        responseSize: JSON.stringify(body).length
      });

      // Log performance warning for slow requests
      if (duration > 5000) {
        logger.warn('Slow request detected', {
          ...context,
          duration,
          threshold: 5000
        });
      }

      return originalJson.call(this, body);
    };

    // Override res.end to log response for non-JSON responses
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - req.startTime;
      
      // Only log if json wasn't already called
      if (!res.headersSent || res.statusCode !== 200) {
        logger.info('Request completed', {
          ...context,
          statusCode: res.statusCode,
          duration
        });

        // Log performance warning for slow requests
        if (duration > 5000) {
          logger.warn('Slow request detected', {
            ...context,
            duration,
            threshold: 5000
          });
        }
      }

      return originalEnd.apply(this, args);
    };

    try {
      return await handler(req, res);
    } catch (error) {
      const duration = Date.now() - req.startTime;
      
      logger.error('Request failed', error, {
        ...context,
        duration
      });

      throw error;
    }
  };
}