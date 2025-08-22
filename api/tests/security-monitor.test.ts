import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { securityMonitor, SecurityEventType, SecurityEvent } from '../lib/security-monitor.js';

describe('Security Monitor', () => {
  beforeEach(() => {
    // Reset security monitor before each test
    securityMonitor.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Security Event Recording', () => {
    it('should record security events with auto-generated IDs', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const event = securityMonitor.recordSecurityEvent(
        SecurityEventType.FAILED_LOGIN,
        'test_source',
        { reason: 'invalid_password' },
        { userId: 123, email: 'test@example.com', ip: '192.168.1.1' }
      );

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe(SecurityEventType.FAILED_LOGIN);
      expect(event.source).toBe('test_source');
      expect(event.userId).toBe(123);
      expect(event.userEmail).toBe('test@example.com');
      expect(event.ipAddress).toBe('192.168.1.1');
      
      mockConsole.mockRestore();
    });

    it('should calculate risk scores correctly', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const lowRiskEvent = securityMonitor.recordSecurityEvent(
        SecurityEventType.FAILED_LOGIN,
        'test',
        {},
        { ip: '192.168.1.1' }
      );

      const highRiskEvent = securityMonitor.recordSecurityEvent(
        SecurityEventType.PRIVILEGE_ESCALATION,
        'test',
        { isAdminAccount: true },
        { ip: '192.168.1.1' }
      );

      expect(lowRiskEvent.risk_score).toBeLessThan(highRiskEvent.risk_score);
      expect(highRiskEvent.risk_score).toBeGreaterThan(8); // Should be high risk
      
      mockConsole.mockRestore();
    });

    it('should assign severity based on risk score', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const criticalEvent = securityMonitor.recordSecurityEvent(
        SecurityEventType.UNAUTHORIZED_ACCESS,
        'test',
        { isAdminAccount: true, fromUnknownLocation: true },
        { ip: '192.168.1.1' }
      );

      expect(criticalEvent.severity).toBe('critical');
      
      mockConsole.mockRestore();
    });
  });

  describe('Failed Login Tracking', () => {
    it('should detect brute force attempts', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const userEmail = 'victim@example.com';
      const ipAddress = '192.168.1.100';
      
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        securityMonitor.recordSecurityEvent(
          SecurityEventType.FAILED_LOGIN,
          'login_endpoint',
          { reason: 'invalid_password' },
          { email: userEmail, ip: ipAddress }
        );
      }
      
      const events = securityMonitor.getSecurityEvents({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT
      });
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].details.userEmail).toBe(userEmail);
      expect(events[0].details.ipAddress).toBe(ipAddress);
      
      mockConsole.mockRestore();
    });
  });

  describe('Suspicious IP Tracking', () => {
    it('should track suspicious IP patterns', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const suspiciousIP = '10.0.0.1';
      
      // Generate multiple events from same IP
      for (let i = 0; i < 12; i++) {
        securityMonitor.recordSecurityEvent(
          SecurityEventType.FAILED_LOGIN,
          'test',
          {},
          { ip: suspiciousIP }
        );
      }
      
      const suspiciousIPs = securityMonitor.getSuspiciousIPs(5);
      expect(suspiciousIPs.length).toBeGreaterThan(0);
      expect(suspiciousIPs[0].ip).toBe(suspiciousIP);
      expect(suspiciousIPs[0].eventCount).toBeGreaterThan(10);
      
      mockConsole.mockRestore();
    });

    it('should record suspicious IP events when threshold is exceeded', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const suspiciousIP = '10.0.0.2';
      
      // Generate enough events to trigger suspicious IP detection
      for (let i = 0; i < 12; i++) {
        securityMonitor.recordSecurityEvent(
          SecurityEventType.FAILED_LOGIN,
          'test',
          {},
          { ip: suspiciousIP }
        );
      }
      
      const suspiciousIPEvents = securityMonitor.getSecurityEvents({
        type: SecurityEventType.SUSPICIOUS_IP
      });
      
      expect(suspiciousIPEvents.length).toBeGreaterThan(0);
      
      mockConsole.mockRestore();
    });
  });

  describe('Unusual Activity Detection', () => {
    it('should detect unusual login times', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock Date to return unusual hour
      const mockDate = new Date('2024-01-01T02:00:00Z'); // 2 AM
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      
      securityMonitor.detectUnusualActivity(123, {
        userId: 123,
        email: 'test@example.com',
        ip: '192.168.1.1'
      });
      
      const unusualEvents = securityMonitor.getSecurityEvents({
        type: SecurityEventType.UNUSUAL_ACTIVITY
      });
      
      expect(unusualEvents.length).toBeGreaterThan(0);
      expect(unusualEvents[0].details.reason).toBe('unusual_login_time');
      
      vi.restoreAllMocks();
      mockConsole.mockRestore();
    });

    it('should detect rapid requests from same user', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const userId = 456;
      
      // Create many events for same user to simulate rapid requests
      for (let i = 0; i < 12; i++) {
        securityMonitor.recordSecurityEvent(
          SecurityEventType.FAILED_LOGIN,
          'test',
          {},
          { userId, email: 'rapid@example.com' }
        );
      }
      
      // This should trigger unusual activity detection
      securityMonitor.detectUnusualActivity(userId, {
        userId,
        email: 'rapid@example.com',
        ip: '192.168.1.1'
      });
      
      const unusualEvents = securityMonitor.getSecurityEvents({
        type: SecurityEventType.UNUSUAL_ACTIVITY,
        userId
      });
      
      expect(unusualEvents.some(e => e.details.reason === 'rapid_requests')).toBe(true);
      
      mockConsole.mockRestore();
    });
  });

  describe('Privilege Escalation Monitoring', () => {
    it('should detect admin privilege escalation', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const oldRoles = ['user'];
      const newRoles = ['user', 'admin'];
      
      securityMonitor.monitorPrivilegeEscalation(123, oldRoles, newRoles, {
        userId: 123,
        email: 'test@example.com'
      });
      
      const escalationEvents = securityMonitor.getSecurityEvents({
        type: SecurityEventType.PRIVILEGE_ESCALATION
      });
      
      expect(escalationEvents).toHaveLength(1);
      expect(escalationEvents[0].details.gainedAdmin).toBe(true);
      
      mockConsole.mockRestore();
    });

    it('should not trigger on non-admin role changes', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const oldRoles = ['user'];
      const newRoles = ['user', 'moderator']; // No admin role
      
      securityMonitor.monitorPrivilegeEscalation(123, oldRoles, newRoles, {
        userId: 123,
        email: 'test@example.com'
      });
      
      const escalationEvents = securityMonitor.getSecurityEvents({
        type: SecurityEventType.PRIVILEGE_ESCALATION
      });
      
      expect(escalationEvents).toHaveLength(0);
      
      mockConsole.mockRestore();
    });
  });

  describe('Event Filtering and Retrieval', () => {
    beforeEach(() => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Create test events
      securityMonitor.recordSecurityEvent(SecurityEventType.FAILED_LOGIN, 'test1', {}, { userId: 1, ip: '192.168.1.1' });
      securityMonitor.recordSecurityEvent(SecurityEventType.BRUTE_FORCE_ATTEMPT, 'test2', {}, { userId: 2, ip: '192.168.1.2' });
      securityMonitor.recordSecurityEvent(SecurityEventType.SUSPICIOUS_IP, 'test3', {}, { ip: '192.168.1.3' });
      
      mockConsole.mockRestore();
    });

    it('should filter events by type', () => {
      const failedLoginEvents = securityMonitor.getSecurityEvents({
        type: SecurityEventType.FAILED_LOGIN
      });
      
      expect(failedLoginEvents).toHaveLength(1);
      expect(failedLoginEvents[0].type).toBe(SecurityEventType.FAILED_LOGIN);
    });

    it('should filter events by user ID', () => {
      const userEvents = securityMonitor.getSecurityEvents({ userId: 1 });
      
      expect(userEvents).toHaveLength(1);
      expect(userEvents[0].userId).toBe(1);
    });

    it('should filter events by IP address', () => {
      const ipEvents = securityMonitor.getSecurityEvents({ ipAddress: '192.168.1.2' });
      
      expect(ipEvents).toHaveLength(1);
      expect(ipEvents[0].ipAddress).toBe('192.168.1.2');
    });

    it('should limit results', () => {
      const limitedEvents = securityMonitor.getSecurityEvents({ limit: 2 });
      expect(limitedEvents).toHaveLength(2);
    });

    it('should filter by time range', () => {
      const recentEvents = securityMonitor.getSecurityEvents({ hoursBack: 1 });
      expect(recentEvents.length).toBeGreaterThan(0); // All events should be recent
    });
  });

  describe('Security Metrics Generation', () => {
    beforeEach(() => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Create diverse test events
      securityMonitor.recordSecurityEvent(SecurityEventType.FAILED_LOGIN, 'test', {}, { userId: 1, email: 'user1@test.com' });
      securityMonitor.recordSecurityEvent(SecurityEventType.FAILED_LOGIN, 'test', {}, { userId: 1, email: 'user1@test.com' });
      securityMonitor.recordSecurityEvent(SecurityEventType.BRUTE_FORCE_ATTEMPT, 'test', {}, { userId: 2, email: 'user2@test.com' });
      securityMonitor.recordSecurityEvent(SecurityEventType.SUSPICIOUS_IP, 'test', {}, { ip: '192.168.1.100' });
      
      mockConsole.mockRestore();
    });

    it('should generate comprehensive security metrics', () => {
      const metrics = securityMonitor.generateSecurityMetrics();
      
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.totalEvents).toBeGreaterThan(0);
      expect(metrics.eventsBySeverity).toBeDefined();
      expect(metrics.eventsByType).toBeDefined();
      expect(typeof metrics.uniqueIPs).toBe('number');
      expect(Array.isArray(metrics.suspiciousIPs)).toBe(true);
      expect(Array.isArray(metrics.topTargetedUsers)).toBe(true);
      expect(typeof metrics.riskScore).toBe('number');
    });

    it('should calculate correct event counts by type', () => {
      const metrics = securityMonitor.generateSecurityMetrics();
      
      expect(metrics.eventsByType[SecurityEventType.FAILED_LOGIN]).toBe(2);
      expect(metrics.eventsByType[SecurityEventType.BRUTE_FORCE_ATTEMPT]).toBe(1);
      expect(metrics.eventsByType[SecurityEventType.SUSPICIOUS_IP]).toBe(1);
    });

    it('should identify top targeted users', () => {
      const metrics = securityMonitor.generateSecurityMetrics();
      
      expect(metrics.topTargetedUsers.length).toBeGreaterThan(0);
      expect(metrics.topTargetedUsers[0].email).toBe('user1@test.com');
      expect(metrics.topTargetedUsers[0].count).toBe(2); // Two events for this user
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up old events', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Create test events
      securityMonitor.recordSecurityEvent(SecurityEventType.FAILED_LOGIN, 'test1', {}, {});
      securityMonitor.recordSecurityEvent(SecurityEventType.FAILED_LOGIN, 'test2', {}, {});
      
      expect(securityMonitor.getSecurityEvents().length).toBe(2);
      
      // Clean up all events (0 hours old)
      const removedCount = securityMonitor.cleanupOldEvents(0);
      
      expect(removedCount).toBe(2);
      expect(securityMonitor.getSecurityEvents().length).toBe(0);
      
      mockConsole.mockRestore();
    });

    it('should clean up IP tracking data', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const testIP = '10.1.1.1';
      
      // Generate events to populate IP tracking
      for (let i = 0; i < 6; i++) {
        securityMonitor.recordSecurityEvent(SecurityEventType.FAILED_LOGIN, 'test', {}, { ip: testIP });
      }
      
      expect(securityMonitor.getSuspiciousIPs(5).length).toBeGreaterThan(0);
      
      // Clean up should remove IP tracking data
      securityMonitor.cleanupOldEvents(0);
      
      expect(securityMonitor.getSuspiciousIPs(5).length).toBe(0);
      
      mockConsole.mockRestore();
    });
  });

  describe('Alert Integration', () => {
    it('should create alerts for critical security events', () => {
      const mockConsole = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // This should trigger a critical alert
      const criticalEvent = securityMonitor.recordSecurityEvent(
        SecurityEventType.UNAUTHORIZED_ACCESS,
        'test',
        { isAdminAccount: true, fromUnknownLocation: true },
        { userId: 999, email: 'admin@test.com' }
      );
      
      expect(criticalEvent.severity).toBe('critical');
      
      mockConsole.mockRestore();
    });
  });
});