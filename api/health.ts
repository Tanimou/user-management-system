import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './lib/prisma.js';
import { setCORSHeaders, setSecurityHeaders } from './lib/auth.js';
import { logger } from './lib/logger.js';
import { withRequestLogging } from './lib/middleware/logging.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    disk?: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  details?: any;
  error?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime > 1000 ? 'warn' : 'pass',
      responseTime,
      details: { connectionPool: 'active' }
    };
  } catch (error: any) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error.message
    };
  }
}

function checkMemory(): HealthCheck {
  if (typeof process !== 'undefined') {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    return {
      status: heapUsedMB > 512 ? 'warn' : 'pass',
      details: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      }
    };
  }
  
  return { status: 'pass', details: { environment: 'serverless' } };
}

const healthHandler = async (req: VercelRequest, res: VercelResponse) => {
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    logger.warn('Invalid method for health check', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const [dbCheck, memCheck] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkMemory())
    ]);
    
    const allChecks = { database: dbCheck, memory: memCheck };
    const hasFailures = Object.values(allChecks).some(check => check.status === 'fail');
    const hasWarnings = Object.values(allChecks).some(check => check.status === 'warn');
    
    const overallStatus: HealthStatus['status'] = 
      hasFailures ? 'unhealthy' : 
      hasWarnings ? 'degraded' : 'healthy';
    
    const response: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime ? process.uptime() : 0,
      checks: allChecks
    };

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    
    logger.info('Health check completed', {
      status: overallStatus,
      duration: Date.now() - startTime,
      statusCode
    });

    res.status(statusCode).json(response);
  } catch (error: any) {
    logger.error('Health check failed', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: 0,
      checks: {
        database: { status: 'fail', error: 'Health check failed' },
        memory: { status: 'fail', error: 'Health check failed' }
      }
    });
  }
};

export default withRequestLogging(healthHandler);
