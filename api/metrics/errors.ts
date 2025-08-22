import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders } from '../../lib/auth.js';
import { logger } from '../../lib/logger.js';
import { withRequestLogging } from '../../lib/middleware/logging.js';
import { errorTracker } from '../../lib/error-tracking.js';

interface FrontendError {
  errorId: string;
  timestamp: string;
  component: string;
  error: string;
  stack?: string;
  userId?: number;
  page: string;
  userAgent: string;
}

const errorReportHandler = async (req: VercelRequest, res: VercelResponse) => {
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
    const errorReport: FrontendError = req.body;

    // Validate required fields
    if (!errorReport.error || !errorReport.component || !errorReport.page) {
      return res.status(400).json({ error: 'Missing required error fields' });
    }

    // Create Error object for tracking
    const error = new Error(errorReport.error);
    if (errorReport.stack) {
      error.stack = errorReport.stack;
    }

    // Track the error
    errorTracker.trackError(error, {
      action: 'frontend_error',
      resource: errorReport.page,
      userId: errorReport.userId,
      userAgent: errorReport.userAgent,
      component: errorReport.component
    });

    // Log frontend error with additional context
    logger.error('Frontend error reported', error, {
      errorId: errorReport.errorId,
      component: errorReport.component,
      page: errorReport.page,
      userId: errorReport.userId,
      userAgent: errorReport.userAgent,
      source: 'frontend'
    });

    res.status(200).json({
      status: 'success',
      message: 'Error report received',
      errorId: errorReport.errorId
    });

  } catch (error: any) {
    logger.error('Failed to process error report', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to process error report'
    });
  }
};

export default withRequestLogging(errorReportHandler);