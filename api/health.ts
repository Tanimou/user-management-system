import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders } from './lib/auth.js';
import { testDatabaseConnection } from './lib/prisma.js';
import DatabaseMonitor from './lib/db-monitoring.js';
import { prisma } from './lib/prisma';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

    // Basic health check data
    const healthStatus = {

    // Test database connection
    let databaseStatus = 'connected';
    let userCount = 0;
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      userCount = await prisma.user.count();
    } catch (dbError) {
      databaseStatus = 'disconnected';
      console.error('Database connection failed:', dbError);
    }
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    return res.status(200).json({

      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {

        database: 'unknown',
        memory: {
          used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
        }
      }
    };

    // Test database connectivity
    if (process.env.DATABASE_URL) {
      try {
        const dbTest = await testDatabaseConnection();
        healthStatus.services.database = dbTest.status;
        
        // Add detailed database metrics if requested and in development
        const includeMetrics = req.query.detailed === 'true' && process.env.NODE_ENV !== 'production';
        
        if (includeMetrics && dbTest.status === 'connected') {
          try {
            const [connectionPool, dbSize] = await Promise.allSettled([
              DatabaseMonitor.getConnectionPoolStatus(),
              DatabaseMonitor.getDatabaseSize()
            ]);
            
            (healthStatus.services as any).databaseDetails = {
              connectionPool: connectionPool.status === 'fulfilled' ? connectionPool.value : null,
              size: dbSize.status === 'fulfilled' ? dbSize.value : null,
              latency: dbTest.latency ? `${Date.now() - dbTest.latency}ms` : null
            };
          } catch (metricsError) {
            console.warn('Failed to get detailed database metrics:', metricsError);
          }
        }
        
        if (dbTest.status === 'disconnected' && process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            ...healthStatus,
            status: 'unhealthy',
            error: 'Database connection failed',
            details: dbTest.error
          });
        }
      } catch (dbError) {
        healthStatus.services.database = 'error';
        
        // In production, fail the health check if database is unreachable
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            ...healthStatus,
            status: 'unhealthy',
            error: 'Database connection error'
          });
        }
      }
    }

    return res.status(200).json(healthStatus);

  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error'
    });
  }
}