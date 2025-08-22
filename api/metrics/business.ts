import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders, verifyToken } from '../lib/auth.js';
import { logger } from '../lib/logger.js';
import { withRequestLogging } from '../lib/middleware/logging.js';
import { businessMetrics } from '../lib/business-metrics.js';
import { alertSystem } from '../lib/alert-system.js';
import { securityMonitor } from '../lib/security-monitor.js';
import { PerformanceMonitor } from '../lib/performance-monitor.js';

interface BusinessMetricsResponse {
  timestamp: string;
  summary: any;
  topMetrics: any[];
  alerts: {
    recent: any[];
    stats: any;
  };
  security: {
    metrics: any;
    events: any[];
  };
  performance: {
    report: any;
  };
}

const businessMetricsHandler = async (req: VercelRequest, res: VercelResponse) => {
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
    // Verify token for admin access
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = verifyToken(token);
    if (!user || !user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info('Business metrics requested', {
      userId: user.userId,
      email: user.email
    });

    // Collect all metrics
    const [
      summary,
      topMetrics,
      alertStats,
      securityMetrics,
      performanceReport
    ] = await Promise.all([
      businessMetrics.generateBusinessMetricsSummary(),
      businessMetrics.getTopMetrics(10),
      alertSystem.getAlertStats(),
      securityMonitor.generateSecurityMetrics(),
      PerformanceMonitor.generatePerformanceReport()
    ]);

    const recentAlerts = alertSystem.getAlerts({ limit: 20 });
    const recentSecurityEvents = securityMonitor.getSecurityEvents({ 
      limit: 20, 
      hoursBack: 24 
    });

    const response: BusinessMetricsResponse = {
      timestamp: new Date().toISOString(),
      summary,
      topMetrics,
      alerts: {
        recent: recentAlerts,
        stats: alertStats
      },
      security: {
        metrics: securityMetrics,
        events: recentSecurityEvents
      },
      performance: {
        report: performanceReport
      }
    };

    logger.info('Business metrics provided', {
      userId: user.userId,
      metricsCount: topMetrics.length,
      alertsCount: recentAlerts.length,
      securityEventsCount: recentSecurityEvents.length
    });

    res.json(response);

  } catch (error: any) {
    logger.error('Failed to get business metrics', error);
    
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: 'Failed to collect business metrics'
    });
  }
};

export default withRequestLogging(businessMetricsHandler);