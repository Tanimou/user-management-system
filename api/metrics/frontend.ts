import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders } from '../../lib/auth.js';
import { logger } from '../../lib/logger.js';
import { withRequestLogging } from '../../lib/middleware/logging.js';

interface FrontendMetric {
  timestamp: string;
  metrics: Record<string, {
    count: number;
    min: number;
    max: number;
    avg: number;
  }>;
  userAgent: string;
  url: string;
}

const frontendMetricsHandler = async (req: VercelRequest, res: VercelResponse) => {
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const frontendMetric: FrontendMetric = req.body;

    // Log frontend metrics for analysis
    logger.info('Frontend metrics received', {
      url: frontendMetric.url,
      userAgent: frontendMetric.userAgent,
      metricsCount: Object.keys(frontendMetric.metrics).length,
      timestamp: frontendMetric.timestamp
    });

    // Log specific performance issues
    for (const [metricName, metricData] of Object.entries(frontendMetric.metrics)) {
      if (metricName.startsWith('page_load_') && metricData.avg > 3000) {
        logger.warn('Slow frontend page load detected', {
          metric: metricName,
          avgTime: metricData.avg,
          maxTime: metricData.max,
          url: frontendMetric.url
        });
      }

      if (metricName.startsWith('api_') && metricData.avg > 2000) {
        logger.warn('Slow frontend API call detected', {
          metric: metricName,
          avgTime: metricData.avg,
          maxTime: metricData.max,
          url: frontendMetric.url
        });
      }

      if (metricName.startsWith('api_errors_')) {
        logger.warn('Frontend API errors detected', {
          metric: metricName,
          errorCount: metricData.count,
          url: frontendMetric.url
        });
      }
    }

    res.status(200).json({ 
      status: 'success',
      message: 'Frontend metrics received',
      processed: Object.keys(frontendMetric.metrics).length
    });

  } catch (error: any) {
    logger.error('Failed to process frontend metrics', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to process frontend metrics'
    });
  }
};

export default withRequestLogging(frontendMetricsHandler);