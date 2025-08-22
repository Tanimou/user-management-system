import { logger, LogContext } from './logger.js';

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: LogContext;
  fingerprint: string;
  count: number;
}

class ErrorTracker {
  private errors: Map<string, ErrorReport> = new Map();
  private errorCounts: Map<string, number> = new Map();

  private generateFingerprint(error: Error, context?: LogContext): string {
    // Create a fingerprint to group similar errors
    const components = [
      error.name,
      error.message,
      context?.action || 'unknown',
      context?.resource || 'unknown'
    ];
    
    return Buffer.from(components.join('|')).toString('base64').slice(0, 16);
  }

  trackError(error: Error, context?: LogContext): void {
    const fingerprint = this.generateFingerprint(error, context);
    const id = `${fingerprint}-${Date.now()}`;
    
    // Update error count
    const currentCount = this.errorCounts.get(fingerprint) || 0;
    this.errorCounts.set(fingerprint, currentCount + 1);

    const errorReport: ErrorReport = {
      id,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      context: context || {},
      fingerprint,
      count: currentCount + 1
    };

    this.errors.set(id, errorReport);

    // Log the error
    logger.error('Error tracked', error, {
      ...context,
      errorId: id,
      fingerprint,
      count: currentCount + 1
    });

    // Check if we should alert on this error
    this.checkAlertThresholds(fingerprint, currentCount + 1);

    // Clean up old errors (keep last 1000)
    if (this.errors.size > 1000) {
      const oldestKey = Array.from(this.errors.keys())[0];
      if (oldestKey) {
        this.errors.delete(oldestKey);
      }
    }
  }

  private checkAlertThresholds(fingerprint: string, count: number): void {
    const thresholds = {
      critical: 50,  // 50 errors in short time
      warning: 10,   // 10 errors
      info: 5       // 5 errors
    };

    if (count === thresholds.critical) {
      logger.error('ALERT: Critical error threshold reached', null, {
        fingerprint,
        count,
        level: 'critical'
      });
    } else if (count === thresholds.warning) {
      logger.warn('ALERT: Warning error threshold reached', {
        fingerprint,
        count,
        level: 'warning'
      });
    } else if (count === thresholds.info) {
      logger.info('ALERT: Error threshold reached', {
        fingerprint,
        count,
        level: 'info'
      });
    }
  }

  getErrorReport(id: string): ErrorReport | undefined {
    return this.errors.get(id);
  }

  getErrorSummary(): Array<{ fingerprint: string; count: number; latestError: ErrorReport }> {
    const summary: Array<{ fingerprint: string; count: number; latestError: ErrorReport }> = [];
    
    for (const [fingerprint, count] of this.errorCounts) {
      // Find the latest error for this fingerprint
      const latestError = Array.from(this.errors.values())
        .filter(e => e.fingerprint === fingerprint)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      if (latestError) {
        summary.push({ fingerprint, count, latestError });
      }
    }
    
    return summary.sort((a, b) => b.count - a.count);
  }

  // Reset error counts (useful for testing or periodic cleanup)
  reset(): void {
    this.errors.clear();
    this.errorCounts.clear();
  }

  // Get error statistics
  getStats(): {
    totalErrors: number;
    uniqueErrors: number;
    recentErrors: number; // last hour
    criticalErrors: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentErrors = Array.from(this.errors.values())
      .filter(error => new Date(error.timestamp).getTime() > oneHourAgo).length;
    
    const criticalErrors = Array.from(this.errorCounts.values())
      .filter(count => count >= 50).length;
    
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      uniqueErrors: this.errorCounts.size,
      recentErrors,
      criticalErrors
    };
  }
}

export const errorTracker = new ErrorTracker();