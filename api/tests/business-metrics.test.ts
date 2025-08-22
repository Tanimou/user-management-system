import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { businessMetrics, BusinessMetric } from '../lib/business-metrics.js';

describe('Business Metrics Tracker', () => {
  beforeEach(() => {
    // Reset metrics before each test
    businessMetrics.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Metric Recording', () => {
    it('should record basic metrics', () => {
      businessMetrics.recordMetric('test_metric', 42, 'count');
      
      const metrics = businessMetrics.getMetrics('test_metric', 10);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric).toBe('test_metric');
      expect(metrics[0].value).toBe(42);
      expect(metrics[0].unit).toBe('count');
    });

    it('should record metrics with labels and metadata', () => {
      const labels = { environment: 'test', version: '1.0' };
      const metadata = { userId: 123 };
      
      businessMetrics.recordMetric('api_call', 250, 'milliseconds', labels, metadata);
      
      const metrics = businessMetrics.getMetrics('api_call', 1);
      expect(metrics[0].labels).toEqual(labels);
      expect(metrics[0].metadata).toEqual(metadata);
    });

    it('should generate unique IDs for metrics', () => {
      businessMetrics.recordMetric('metric1', 1);
      businessMetrics.recordMetric('metric1', 2);
      
      const metrics = businessMetrics.getMetrics('metric1', 10);
      expect(metrics).toHaveLength(2);
      expect(metrics[0].id).not.toBe(metrics[1].id);
    });
  });

  describe('User Tracking', () => {
    it('should track user registration', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      businessMetrics.trackUserRegistration(123, ['user'], {
        userId: 123,
        email: 'test@example.com'
      });
      
      const registrationMetrics = businessMetrics.getMetrics('user_registration', 10);
      expect(registrationMetrics).toHaveLength(1);
      expect(registrationMetrics[0].value).toBe(1);
      expect(registrationMetrics[0].labels?.roles).toBe('user');
      
      mockConsole.mockRestore();
    });

    it('should track admin registration separately', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      businessMetrics.trackUserRegistration(456, ['user', 'admin'], {
        userId: 456,
        email: 'admin@example.com'
      });
      
      const adminRegistrationMetrics = businessMetrics.getMetrics('admin_user_registration', 10);
      expect(adminRegistrationMetrics).toHaveLength(1);
      expect(adminRegistrationMetrics[0].metadata?.userId).toBe(456);
      
      mockConsole.mockRestore();
    });

    it('should track successful logins', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      businessMetrics.trackUserLogin(123, true, 'password', {
        userId: 123,
        email: 'test@example.com'
      });
      
      const loginMetrics = businessMetrics.getMetrics('successful_login', 10);
      expect(loginMetrics).toHaveLength(1);
      expect(loginMetrics[0].labels?.method).toBe('password');
      
      mockConsole.mockRestore();
    });

    it('should track failed logins', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      businessMetrics.trackUserLogin(123, false, 'password', {
        userId: 123,
        email: 'test@example.com'
      });
      
      const failedLoginMetrics = businessMetrics.getMetrics('failed_login', 10);
      expect(failedLoginMetrics).toHaveLength(1);
      expect(failedLoginMetrics[0].labels?.method).toBe('password');
      
      mockConsole.mockRestore();
    });

    it('should track role changes', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      businessMetrics.trackRoleChange(123, ['user'], ['user', 'admin'], {
        userId: 123,
        email: 'test@example.com'
      });
      
      const roleChangeMetrics = businessMetrics.getMetrics('role_change', 10);
      expect(roleChangeMetrics).toHaveLength(1);
      expect(roleChangeMetrics[0].labels?.oldRoles).toBe('user');
      expect(roleChangeMetrics[0].labels?.newRoles).toBe('user,admin');
      
      mockConsole.mockRestore();
    });
  });

  describe('API Tracking', () => {
    it('should track API requests', () => {
      businessMetrics.trackApiEndpoint('/users', 'GET', 200, 150);
      
      const apiMetrics = businessMetrics.getMetrics('api_request', 10);
      expect(apiMetrics).toHaveLength(1);
      expect(apiMetrics[0].labels?.endpoint).toBe('/users');
      expect(apiMetrics[0].labels?.method).toBe('GET');
      expect(apiMetrics[0].labels?.statusCode).toBe('200');
    });

    it('should track response times', () => {
      businessMetrics.trackApiEndpoint('/users', 'POST', 201, 275);
      
      const responseTimeMetrics = businessMetrics.getMetrics('api_response_time', 10);
      expect(responseTimeMetrics).toHaveLength(1);
      expect(responseTimeMetrics[0].value).toBe(275);
      expect(responseTimeMetrics[0].unit).toBe('milliseconds');
    });

    it('should track API errors', () => {
      businessMetrics.trackApiEndpoint('/users/999', 'DELETE', 404, 50);
      
      const errorMetrics = businessMetrics.getMetrics('api_error', 10);
      expect(errorMetrics).toHaveLength(1);
      expect(errorMetrics[0].labels?.statusCode).toBe('404');
    });

    it('should not track errors for successful status codes', () => {
      businessMetrics.trackApiEndpoint('/users', 'GET', 200, 100);
      
      const errorMetrics = businessMetrics.getMetrics('api_error', 10);
      expect(errorMetrics).toHaveLength(0);
    });
  });

  describe('Security Tracking', () => {
    it('should track security events', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      businessMetrics.trackSecurityEvent('failed_login', 'high', {
        userId: 123,
        ip: '192.168.1.1'
      });
      
      const securityMetrics = businessMetrics.getMetrics('security_event', 10);
      expect(securityMetrics).toHaveLength(1);
      expect(securityMetrics[0].labels?.event).toBe('failed_login');
      expect(securityMetrics[0].labels?.severity).toBe('high');
      
      mockConsole.mockRestore();
    });
  });

  describe('Aggregated Metrics', () => {
    beforeEach(() => {
      // Create test data
      businessMetrics.recordMetric('test_aggregation', 10);
      businessMetrics.recordMetric('test_aggregation', 20);
      businessMetrics.recordMetric('test_aggregation', 30);
      businessMetrics.recordMetric('test_aggregation', 40);
      businessMetrics.recordMetric('test_aggregation', 50);
    });

    it('should calculate aggregated statistics', () => {
      const aggregated = businessMetrics.getAggregatedMetrics('test_aggregation', 24);
      
      expect(aggregated.count).toBe(5);
      expect(aggregated.total).toBe(150);
      expect(aggregated.average).toBe(30);
      expect(aggregated.min).toBe(10);
      expect(aggregated.max).toBe(50);
    });

    it('should handle empty metrics', () => {
      const aggregated = businessMetrics.getAggregatedMetrics('nonexistent_metric', 24);
      
      expect(aggregated.count).toBe(0);
      expect(aggregated.total).toBe(0);
      expect(aggregated.average).toBe(0);
      expect(aggregated.min).toBe(0);
      expect(aggregated.max).toBe(0);
    });
  });

  describe('Top Metrics', () => {
    beforeEach(() => {
      // Create test metrics with different values
      businessMetrics.recordMetric('high_metric', 100);
      businessMetrics.recordMetric('medium_metric', 50);
      businessMetrics.recordMetric('low_metric', 10);
      
      // Wait a bit to create trend data
      setTimeout(() => {
        businessMetrics.recordMetric('high_metric', 120);
        businessMetrics.recordMetric('medium_metric', 45);
        businessMetrics.recordMetric('low_metric', 15);
      }, 100);
    });

    it('should return top metrics ordered by total value', () => {
      const topMetrics = businessMetrics.getTopMetrics(5);
      
      expect(topMetrics.length).toBeGreaterThan(0);
      expect(topMetrics[0].totalValue).toBeGreaterThanOrEqual(topMetrics[1]?.totalValue || 0);
    });

    it('should include trend information', () => {
      const topMetrics = businessMetrics.getTopMetrics(5);
      
      for (const metric of topMetrics) {
        expect(['up', 'down', 'stable']).toContain(metric.trend);
        expect(typeof metric.recentValue).toBe('number');
      }
    });
  });

  describe('Metric Export', () => {
    beforeEach(() => {
      businessMetrics.recordMetric('export_test_1', 10);
      businessMetrics.recordMetric('export_test_2', 20);
    });

    it('should export all metrics by default', () => {
      const exported = businessMetrics.exportMetrics();
      expect(exported.length).toBe(2);
      expect(exported.some(m => m.metric === 'export_test_1')).toBe(true);
      expect(exported.some(m => m.metric === 'export_test_2')).toBe(true);
    });

    it('should export specific metrics when requested', () => {
      const exported = businessMetrics.exportMetrics(['export_test_1']);
      expect(exported.length).toBe(1);
      expect(exported[0].metric).toBe('export_test_1');
    });

    it('should export metrics sorted by timestamp', () => {
      const exported = businessMetrics.exportMetrics();
      expect(exported.length).toBe(2);
      
      // First metric should have earlier or equal timestamp
      const time1 = new Date(exported[0].timestamp).getTime();
      const time2 = new Date(exported[1].timestamp).getTime();
      expect(time1).toBeLessThanOrEqual(time2);
    });
  });

  describe('Cleanup', () => {
    it('should clear old metrics', () => {
      businessMetrics.recordMetric('cleanup_test', 1);
      businessMetrics.recordMetric('cleanup_test', 2);
      
      expect(businessMetrics.getMetrics('cleanup_test').length).toBe(2);
      
      // Clear all metrics (0 hours old)
      const removedCount = businessMetrics.clearOldMetrics(0);
      expect(removedCount).toBe(2);
      expect(businessMetrics.getMetrics('cleanup_test').length).toBe(0);
    });

    it('should return tracked metrics list', () => {
      businessMetrics.recordMetric('metric_a', 1);
      businessMetrics.recordMetric('metric_b', 2);
      businessMetrics.recordMetric('metric_c', 3);
      
      const trackedMetrics = businessMetrics.getTrackedMetrics();
      expect(trackedMetrics).toContain('metric_a');
      expect(trackedMetrics).toContain('metric_b');
      expect(trackedMetrics).toContain('metric_c');
      expect(trackedMetrics).toEqual(trackedMetrics.sort()); // Should be sorted
    });
  });
});