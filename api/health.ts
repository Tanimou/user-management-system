import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders } from './lib/auth.js';

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
    // Basic health check
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      uptime: process.uptime(),
      services: {
        database: 'unknown', // Could add DB ping here
        memory: {
          used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
        }
      }
    };

    // Optional: Add database connectivity check
    if (process.env.DATABASE_URL) {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$queryRaw`SELECT 1`;
        healthStatus.services.database = 'connected';
        await prisma.$disconnect();
      } catch (dbError) {
        healthStatus.services.database = 'disconnected';
        // Don't fail health check for DB issues in development
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            ...healthStatus,
            status: 'unhealthy',
            error: 'Database connection failed'
          });
        }
      }
    }

    return res.status(200).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error'
    });
  }
}