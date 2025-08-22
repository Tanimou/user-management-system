import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { alertSystem, Alert, AlertRule } from '../lib/alert-system.js';

describe('Alert System', () => {
  beforeEach(() => {
    // Reset alerts before each test
    alertSystem.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Alert Creation', () => {
    it('should create alert with auto-generated ID and timestamp', () => {
      const alert = alertSystem.createAlert({
        severity: 'warning',
        title: 'Test Alert',
        message: 'This is a test alert',
        source: 'system'
      });

      expect(alert.id).toBeDefined();
      expect(alert.timestamp).toBeDefined();
      expect(alert.severity).toBe('warning');
      expect(alert.title).toBe('Test Alert');
      expect(alert.message).toBe('This is a test alert');
      expect(alert.source).toBe('system');
    });

    it('should include metadata when provided', () => {
      const metadata = { userId: 123, component: 'auth' };
      const alert = alertSystem.createAlert({
        severity: 'critical',
        title: 'Critical Error',
        message: 'System failure',
        source: 'security',
        metadata
      });

      expect(alert.metadata).toEqual(metadata);
    });
  });

  describe('Alert Filtering', () => {
    beforeEach(() => {
      // Create test alerts
      alertSystem.createAlert({
        severity: 'critical',
        title: 'Critical Alert',
        message: 'Critical issue',
        source: 'database'
      });

      alertSystem.createAlert({
        severity: 'warning',
        title: 'Warning Alert',
        message: 'Warning issue',
        source: 'system'
      });

      alertSystem.createAlert({
        severity: 'info',
        title: 'Info Alert',
        message: 'Info message',
        source: 'api'
      });
    });

    it('should filter alerts by severity', () => {
      const criticalAlerts = alertSystem.getAlerts({ severity: 'critical' });
      expect(criticalAlerts).toHaveLength(1);
      expect(criticalAlerts[0].severity).toBe('critical');
    });

    it('should filter alerts by source', () => {
      const systemAlerts = alertSystem.getAlerts({ source: 'system' });
      expect(systemAlerts).toHaveLength(1);
      expect(systemAlerts[0].source).toBe('system');
    });

    it('should limit results', () => {
      const limitedAlerts = alertSystem.getAlerts({ limit: 2 });
      expect(limitedAlerts).toHaveLength(2);
    });

    it('should filter alerts by time', () => {
      const recentTime = new Date().toISOString();
      const recentAlerts = alertSystem.getAlerts({ since: recentTime });
      // All alerts should be recent since we just created them
      expect(recentAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Rule Evaluation', () => {
    it('should trigger alerts when conditions are met', () => {
      const performanceData = {
        responseTime: 6000, // Above critical threshold
        connectionPoolUsage: 95, // Above critical threshold
        slowQueries: 25 // Above warning threshold
      };

      const alerts = alertSystem.evaluateRules(performanceData, 'performance');

      // Should trigger multiple alerts
      expect(alerts.length).toBeGreaterThan(0);
      
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should not trigger alerts when conditions are not met', () => {
      const performanceData = {
        responseTime: 500, // Below thresholds
        connectionPoolUsage: 40, // Below thresholds
        slowQueries: 2 // Below thresholds
      };

      const alerts = alertSystem.evaluateRules(performanceData, 'performance');
      expect(alerts).toHaveLength(0);
    });

    it('should respect throttling rules', () => {
      const performanceData = { responseTime: 6000 };

      // First evaluation should trigger alert
      const firstAlerts = alertSystem.evaluateRules(performanceData, 'performance');
      expect(firstAlerts.length).toBeGreaterThan(0);

      // Immediate second evaluation should be throttled
      const secondAlerts = alertSystem.evaluateRules(performanceData, 'performance');
      expect(secondAlerts).toHaveLength(0);
    });
  });

  describe('Alert Statistics', () => {
    beforeEach(() => {
      // Create test alerts for statistics
      alertSystem.createAlert({ severity: 'critical', title: 'C1', message: 'Critical 1', source: 'database' });
      alertSystem.createAlert({ severity: 'critical', title: 'C2', message: 'Critical 2', source: 'system' });
      alertSystem.createAlert({ severity: 'warning', title: 'W1', message: 'Warning 1', source: 'api' });
      alertSystem.createAlert({ severity: 'info', title: 'I1', message: 'Info 1', source: 'security' });
    });

    it('should provide accurate statistics', () => {
      const stats = alertSystem.getAlertStats();

      expect(stats.total).toBe(4);
      expect(stats.bySeverity.critical).toBe(2);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.bySeverity.info).toBe(1);
      expect(stats.bySource.database).toBe(1);
      expect(stats.bySource.system).toBe(1);
      expect(stats.bySource.api).toBe(1);
      expect(stats.bySource.security).toBe(1);
      expect(stats.recentCount).toBe(4); // All are recent
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding custom alert rules', () => {
      const customRule: AlertRule = {
        id: 'custom-test-rule',
        name: 'Custom Test Rule',
        enabled: true,
        condition: (data: any) => data.testValue > 100,
        severity: 'warning',
        title: 'Custom Test Alert',
        message: 'Custom test condition met',
        source: 'system'
      };

      alertSystem.addRule(customRule);
      const rules = alertSystem.getRules();
      
      expect(rules.some(r => r.id === 'custom-test-rule')).toBe(true);
    });

    it('should evaluate custom rules', () => {
      const customRule: AlertRule = {
        id: 'custom-test-rule-2',
        name: 'Custom Test Rule 2',
        enabled: true,
        condition: (data: any) => data.testValue > 50,
        severity: 'info',
        title: 'Custom Test Alert',
        message: 'Custom test condition met',
        source: 'system'
      };

      alertSystem.addRule(customRule);
      
      const testData = { testValue: 75 };
      const alerts = alertSystem.evaluateRules(testData, 'system');
      
      expect(alerts.some(a => a.title === 'Custom Test Alert')).toBe(true);
    });

    it('should allow disabling rules', () => {
      const customRule: AlertRule = {
        id: 'custom-test-rule-3',
        name: 'Custom Test Rule 3',
        enabled: true,
        condition: (data: any) => data.testValue > 30,
        severity: 'info',
        title: 'Custom Test Alert 3',
        message: 'Custom test condition met',
        source: 'system'
      };

      alertSystem.addRule(customRule);
      alertSystem.setRuleEnabled('custom-test-rule-3', false);
      
      const testData = { testValue: 50 };
      const alerts = alertSystem.evaluateRules(testData, 'system');
      
      expect(alerts.some(a => a.title === 'Custom Test Alert 3')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should clear old alerts', () => {
      // Create some test alerts
      alertSystem.createAlert({ severity: 'info', title: 'Test', message: 'Test', source: 'system' });
      alertSystem.createAlert({ severity: 'info', title: 'Test2', message: 'Test2', source: 'system' });
      
      expect(alertSystem.getAlerts()).toHaveLength(2);
      
      // Clear alerts older than 0 hours (all alerts)
      const removedCount = alertSystem.clearOldAlerts(0);
      
      expect(removedCount).toBe(2);
      expect(alertSystem.getAlerts()).toHaveLength(0);
    });
  });
});