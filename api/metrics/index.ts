import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PerformanceMonitor } from '../lib/performance-monitoring.js';
import { errorTracker } from '../lib/error-tracking.js';
import { prisma } from '../lib/prisma.js';
import { setCORSHeaders, setSecurityHeaders } from '../lib/auth.js';
import { logger } from '../lib/logger.js';
import { withRequestLogging } from '../lib/middleware/logging.js';

interface MetricsResponse {
  timestamp: string;
  uptime: number;
  performance: Record<string, any>;
  errors: Array<{ fingerprint: string; count: number; latestError: any }>;
  database: {
    connections: number;
    slowQueries: number;
  };
  system: {
    memory: any;
    version: string;
  };
}

const metricsHandler = async (req: VercelRequest, res: VercelResponse) => {
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get database connection info (simplified for serverless)
    let connections = 0;
    try {
      // For serverless, we can't get actual connection pool info easily
      // This is a placeholder that would work with a proper connection pool
      await prisma.$queryRaw`SELECT 1`;
      connections = 1; // Simplified - in a real setup you'd query connection pool stats
    } catch (error) {
      logger.error('Failed to get database stats', error);
    }

    const metrics: MetricsResponse = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : 0,
      performance: PerformanceMonitor.getAllMetrics(),
      errors: errorTracker.getErrorSummary(),
      database: {
        connections,
        slowQueries: 0 // Could implement slow query tracking
      },
      system: {
        memory: process.memoryUsage ? process.memoryUsage() : null,
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    logger.info('Metrics requested', {
      totalMetrics: Object.keys(metrics.performance).length,
      errorCount: metrics.errors.length
    });

    res.json(metrics);
  } catch (error: any) {
    logger.error('Metrics endpoint failed', error);
    
    res.status(500).json({
      timestamp: new Date().toISOString(),
      uptime: 0,
      performance: {},
      errors: [],
      database: { connections: 0, slowQueries: 0 },
      system: { memory: null, version: '1.0.0' },
      error: 'Failed to collect metrics'
    });
  }
};

export default withRequestLogging(metricsHandler);