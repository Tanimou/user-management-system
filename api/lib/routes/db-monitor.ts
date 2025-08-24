import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  setCORSHeaders,
  setSecurityHeaders,
  requireAuth,
  AuthenticatedRequest,
} from '../../lib/auth.js';
import DatabaseMonitor from '../../lib/db-monitoring.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication - only authenticated users can access detailed metrics
    const authReq = req as AuthenticatedRequest;
    if (!(await requireAuth(authReq, res))) {
      return; // requireAuth already sent the response
    }

    // Only admin users can access database monitoring
    const { user } = authReq;
    if (!user?.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get monitoring metrics based on query parameters
    const { metrics = 'basic', performance = 'false' } = req.query;

    let result: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    };

    if (metrics === 'basic' || metrics === 'all') {
      const [connectionPool, databaseSize] = await Promise.allSettled([
        DatabaseMonitor.getConnectionPoolStatus(),
        DatabaseMonitor.getDatabaseSize()
      ]);

      result.basic = {
        connectionPool: connectionPool.status === 'fulfilled' ? connectionPool.value : null,
        databaseSize: databaseSize.status === 'fulfilled' ? databaseSize.value : null
      };
    }

    if (metrics === 'detailed' || metrics === 'all') {
      const healthMetrics = await DatabaseMonitor.getHealthMetrics();
      result.detailed = healthMetrics;
    }

    if (performance === 'true') {
      const performanceMetrics = await DatabaseMonitor.performanceTest();
      result.performance = {
        ...performanceMetrics,
        note: 'Performance test results in milliseconds'
      };
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Database monitoring error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve database metrics',
      timestamp: new Date().toISOString()
    });
  }
}