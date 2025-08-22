import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../lib/logger.js';
import { errorTracker } from '../lib/error-tracking.js';
import { PerformanceMonitor } from '../lib/performance-monitoring.js';

describe('Monitoring Infrastructure', () => {
  beforeEach(() => {
    // Reset monitoring state before each test
    errorTracker.reset();
    PerformanceMonitor.reset();
  });

  describe('Logger', () => {
    it('should log info messages with context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info('Test message', { userId: 123, action: 'test' });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log errors with stack traces', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('Test error');
      
      logger.error('Error occurred', error, { userId: 123 });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log security events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.security('Failed login attempt', { 
        email: 'test@example.com',
        ip: '192.168.1.1' 
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log performance metrics', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.performance('database_query', 250, { operation: 'user_lookup' });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log business events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.business('User created', { 
        userId: 123,
        email: 'new@example.com' 
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Tracker', () => {
    it('should track errors with context', () => {
      const error = new Error('Test error');
      const context = { userId: 123, action: 'test_operation' };
      
      errorTracker.trackError(error, context);
      
      const summary = errorTracker.getErrorSummary();
      expect(summary).toHaveLength(1);
      expect(summary[0].count).toBe(1);
      expect(summary[0].latestError.error.message).toBe('Test error');
    });

    it('should group similar errors by fingerprint', () => {
      const error1 = new Error('Database connection failed');
      const error2 = new Error('Database connection failed');
      const context = { action: 'database_operation' };
      
      errorTracker.trackError(error1, context);
      errorTracker.trackError(error2, context);
      
      const summary = errorTracker.getErrorSummary();
      expect(summary).toHaveLength(1);
      expect(summary[0].count).toBe(2);
    });

    it('should provide error statistics', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      
      errorTracker.trackError(error1);
      errorTracker.trackError(error2);
      
      const stats = errorTracker.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.uniqueErrors).toBe(2);
    });

    it('should limit error storage to prevent memory issues', () => {
      // Add more than 1000 errors to test cleanup
      for (let i = 0; i < 1005; i++) {
        errorTracker.trackError(new Error(`Error ${i}`));
      }
      
      const summary = errorTracker.getErrorSummary();
      expect(summary.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Performance Monitor', () => {
    it('should record and retrieve metrics', () => {
      PerformanceMonitor.recordMetric('test_operation', 100);
      PerformanceMonitor.recordMetric('test_operation', 200);
      
      const metrics = PerformanceMonitor.getMetrics('test_operation');
      
      expect(metrics).toBeDefined();
      expect(metrics!.count).toBe(2);
      expect(metrics!.min).toBe(100);
      expect(metrics!.max).toBe(200);
      expect(metrics!.avg).toBe(150);
    });

    it('should calculate 95th percentile correctly', () => {
      // Add 100 values from 1 to 100
      for (let i = 1; i <= 100; i++) {
        PerformanceMonitor.recordMetric('percentile_test', i);
      }
      
      const metrics = PerformanceMonitor.getMetrics('percentile_test');
      
      expect(metrics).toBeDefined();
      expect(metrics!.p95).toBe(95);
    });

    it('should track timing with withTiming method', async () => {
      const result = await PerformanceMonitor.withTiming('async_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });
      
      expect(result).toBe('success');
      
      const metrics = PerformanceMonitor.getMetrics('async_operation');
      expect(metrics).toBeDefined();
      expect(metrics!.count).toBe(1);
      expect(metrics!.avg).toBeGreaterThan(5);
    });

    it('should handle errors in timed operations', async () => {
      try {
        await PerformanceMonitor.withTiming('failing_operation', async () => {
          throw new Error('Operation failed');
        });
      } catch (error) {
        expect(error.message).toBe('Operation failed');
      }
      
      const errorMetrics = PerformanceMonitor.getMetrics('failing_operation_error');
      expect(errorMetrics).toBeDefined();
      expect(errorMetrics!.count).toBe(1);
    });

    it('should provide performance summary', () => {
      PerformanceMonitor.recordMetric('fast_op', 50);
      PerformanceMonitor.recordMetric('slow_op', 1000);
      PerformanceMonitor.recordMetric('medium_op', 500);
      
      const summary = PerformanceMonitor.getSummary();
      
      expect(summary.totalMetrics).toBe(3);
      expect(summary.slowOperations).toHaveLength(3);
      expect(summary.slowOperations[0].name).toBe('slow_op');
      expect(summary.fastOperations).toHaveLength(3);
      expect(summary.fastOperations[0].name).toBe('fast_op');
    });

    it('should limit metric history to prevent memory issues', () => {
      // Add more than 100 values to test cleanup
      for (let i = 0; i < 150; i++) {
        PerformanceMonitor.recordMetric('memory_test', i);
      }
      
      const metrics = PerformanceMonitor.getMetrics('memory_test');
      expect(metrics!.count).toBe(100); // Should be limited to 100
    });
  });
});