import type { VercelRequest, VercelResponse } from '@vercel/node';
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
        database: databaseStatus,
        memory: {
          used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
          total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        },
      },
      data: {
        userCount,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    });
  }
}
