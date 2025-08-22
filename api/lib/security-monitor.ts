/**
 * Security monitoring system for detecting and tracking security events
 */

import { logger, LogContext } from './logger.js';
import { businessMetrics } from './business-metrics.js';
import { alertSystem } from './alert-system.js';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  userId?: number;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  risk_score: number;
}

export enum SecurityEventType {
  FAILED_LOGIN = 'failed_login',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  ACCOUNT_LOCKOUT = 'account_lockout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  SUSPICIOUS_IP = 'suspicious_ip',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  TOKEN_MANIPULATION = 'token_manipulation'
}

export interface SecurityMetrics {
  timestamp: string;
  totalEvents: number;
  eventsBySeverity: Record<string, number>;
  eventsByType: Record<string, number>;
  uniqueIPs: number;
  suspiciousIPs: string[];
  topTargetedUsers: Array<{ userId: number; email: string; count: number }>;
  recentAlerts: number;
  riskScore: number;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private suspiciousIPs: Map<string, { count: number; lastSeen: Date; events: SecurityEventType[] }> = new Map();
  private failedLoginAttempts: Map<string, { count: number; firstAttempt: Date; lastAttempt: Date }> = new Map();
  private maxEvents = 10000;

  /**
   * Generate unique security event ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate risk score for an event
   */
  private calculateRiskScore(type: SecurityEventType, details: Record<string, any>): number {
    const baseScores: Record<SecurityEventType, number> = {
      [SecurityEventType.FAILED_LOGIN]: 2,
      [SecurityEventType.BRUTE_FORCE_ATTEMPT]: 8,
      [SecurityEventType.SUSPICIOUS_LOGIN]: 6,
      [SecurityEventType.UNAUTHORIZED_ACCESS]: 9,
      [SecurityEventType.PRIVILEGE_ESCALATION]: 10,
      [SecurityEventType.UNUSUAL_ACTIVITY]: 4,
      [SecurityEventType.ACCOUNT_LOCKOUT]: 5,
      [SecurityEventType.PASSWORD_RESET_REQUEST]: 3,
      [SecurityEventType.SUSPICIOUS_IP]: 7,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: 6,
      [SecurityEventType.INVALID_TOKEN]: 4,
      [SecurityEventType.TOKEN_MANIPULATION]: 9
    };

    let score = baseScores[type] || 1;

    // Adjust score based on details
    if (details.isAdminAccount) score += 3;
    if (details.fromUnknownLocation) score += 2;
    if (details.unusualUserAgent) score += 1;
    if (details.rapidRequests) score += 2;
    if (details.multipleSources) score += 2;

    return Math.min(10, score);
  }

  /**
   * Record a security event
   */
  recordSecurityEvent(
    type: SecurityEventType,
    source: string,
    details: Record<string, any> = {},
    context?: LogContext
  ): SecurityEvent {
    const riskScore = this.calculateRiskScore(type, details);
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 9) severity = 'critical';
    else if (riskScore >= 7) severity = 'high';
    else if (riskScore >= 4) severity = 'medium';
    else severity = 'low';

    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type,
      severity,
      source,
      userId: context?.userId,
      userEmail: context?.email,
      ipAddress: Array.isArray(context?.ip) ? context.ip[0] : context?.ip,
      userAgent: context?.userAgent,
      details,
      risk_score: riskScore
    };

    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Track IP patterns
    if (event.ipAddress) {
      this.trackSuspiciousIP(event.ipAddress, type);
    }

    // Track failed login patterns
    if (type === SecurityEventType.FAILED_LOGIN && event.userEmail) {
      this.trackFailedLogin(event.userEmail, event.ipAddress);
    }

    // Log security event
    logger.security(`Security event: ${type}`, {
      ...context,
      eventId: event.id,
      severity,
      riskScore,
      details
    });

    // Record business metric
    businessMetrics.trackSecurityEvent(type, severity, context);

    // Check for alert conditions
    this.checkAlertConditions(event);

    return event;
  }

  /**
   * Track suspicious IP patterns
   */
  private trackSuspiciousIP(ipAddress: string, eventType: SecurityEventType): void {
    const existing = this.suspiciousIPs.get(ipAddress) || {
      count: 0,
      lastSeen: new Date(),
      events: []
    };

    existing.count++;
    existing.lastSeen = new Date();
    existing.events.push(eventType);

    // Keep only recent events per IP
    if (existing.events.length > 50) {
      existing.events = existing.events.slice(-50);
    }

    this.suspiciousIPs.set(ipAddress, existing);

    // Alert if IP shows high activity
    if (existing.count > 10) {
      this.recordSecurityEvent(
        SecurityEventType.SUSPICIOUS_IP,
        'security_monitor',
        { 
          ipAddress, 
          eventCount: existing.count,
          eventTypes: [...new Set(existing.events)]
        },
        { ip: ipAddress }
      );
    }
  }

  /**
   * Track failed login patterns
   */
  private trackFailedLogin(userEmail: string, ipAddress?: string): void {
    const key = `${userEmail}:${ipAddress || 'unknown'}`;
    const existing = this.failedLoginAttempts.get(key) || {
      count: 0,
      firstAttempt: new Date(),
      lastAttempt: new Date()
    };

    existing.count++;
    existing.lastAttempt = new Date();

    this.failedLoginAttempts.set(key, existing);

    // Check for brute force patterns
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    const timeSinceFirst = existing.lastAttempt.getTime() - existing.firstAttempt.getTime();

    if (existing.count >= 5 && timeSinceFirst <= timeWindow) {
      this.recordSecurityEvent(
        SecurityEventType.BRUTE_FORCE_ATTEMPT,
        'security_monitor',
        {
          userEmail,
          ipAddress,
          attempts: existing.count,
          timeWindowMinutes: Math.round(timeSinceFirst / (1000 * 60))
        },
        { email: userEmail, ip: ipAddress }
      );
    }
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(event: SecurityEvent): void {
    // High severity events trigger immediate alerts
    if (event.severity === 'critical') {
      alertSystem.createAlert({
        severity: 'critical',
        title: 'Critical Security Event',
        message: `${event.type}: ${JSON.stringify(event.details)}`,
        source: 'security',
        metadata: event
      });
    } else if (event.severity === 'high') {
      alertSystem.createAlert({
        severity: 'warning',
        title: 'High Risk Security Event',
        message: `${event.type} detected from ${event.ipAddress || 'unknown IP'}`,
        source: 'security',
        metadata: event
      });
    }

    // Check for patterns that indicate coordinated attacks
    this.checkForCoordinatedAttacks();
  }

  /**
   * Check for coordinated attack patterns
   */
  private checkForCoordinatedAttacks(): void {
    const recentWindow = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    
    const recentEvents = this.events.filter(
      event => now - new Date(event.timestamp).getTime() <= recentWindow
    );

    // Check for high volume of events
    if (recentEvents.length > 20) {
      const uniqueIPs = new Set(recentEvents.map(e => e.ipAddress).filter(Boolean));
      const uniqueUsers = new Set(recentEvents.map(e => e.userId).filter(Boolean));

      alertSystem.createAlert({
        severity: 'warning',
        title: 'Possible Coordinated Attack',
        message: `High volume of security events: ${recentEvents.length} events from ${uniqueIPs.size} IPs targeting ${uniqueUsers.size} users`,
        source: 'security',
        metadata: {
          eventCount: recentEvents.length,
          uniqueIPs: uniqueIPs.size,
          uniqueUsers: uniqueUsers.size,
          timeWindow: '10 minutes'
        }
      });
    }
  }

  /**
   * Detect unusual activity patterns
   */
  detectUnusualActivity(userId: number, context: LogContext): void {
    // Check for unusual login times
    const now = new Date();
    const hour = now.getHours();
    
    // Flag logins during unusual hours (11 PM - 5 AM)
    if (hour >= 23 || hour <= 5) {
      this.recordSecurityEvent(
        SecurityEventType.UNUSUAL_ACTIVITY,
        'activity_detector',
        { reason: 'unusual_login_time', hour },
        context
      );
    }

    // Check for rapid requests from same user
    const recentUserEvents = this.events
      .filter(e => e.userId === userId)
      .filter(e => now.getTime() - new Date(e.timestamp).getTime() <= 5 * 60 * 1000); // 5 minutes

    if (recentUserEvents.length > 10) {
      this.recordSecurityEvent(
        SecurityEventType.UNUSUAL_ACTIVITY,
        'activity_detector',
        { reason: 'rapid_requests', count: recentUserEvents.length },
        context
      );
    }
  }

  /**
   * Monitor for privilege escalation attempts
   */
  monitorPrivilegeEscalation(userId: number, oldRoles: string[], newRoles: string[], context: LogContext): void {
    const gainedAdmin = !oldRoles.includes('admin') && newRoles.includes('admin');
    
    if (gainedAdmin) {
      this.recordSecurityEvent(
        SecurityEventType.PRIVILEGE_ESCALATION,
        'role_monitor',
        {
          oldRoles,
          newRoles,
          gainedAdmin: true
        },
        context
      );
    }
  }

  /**
   * Get security events with filtering
   */
  getSecurityEvents(options: {
    type?: SecurityEventType;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    userId?: number;
    ipAddress?: string;
    limit?: number;
    hoursBack?: number;
  } = {}): SecurityEvent[] {
    let events = [...this.events];

    // Apply time filter
    if (options.hoursBack) {
      const cutoff = new Date(Date.now() - options.hoursBack * 60 * 60 * 1000);
      events = events.filter(event => new Date(event.timestamp) >= cutoff);
    }

    // Apply other filters
    if (options.type) {
      events = events.filter(event => event.type === options.type);
    }
    
    if (options.severity) {
      events = events.filter(event => event.severity === options.severity);
    }
    
    if (options.userId) {
      events = events.filter(event => event.userId === options.userId);
    }
    
    if (options.ipAddress) {
      events = events.filter(event => event.ipAddress === options.ipAddress);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Generate security metrics summary
   */
  generateSecurityMetrics(): SecurityMetrics {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const events24h = this.events.filter(event => new Date(event.timestamp) >= new Date(Date.now() - 24 * 60 * 60 * 1000));
    const recentAlerts = this.events.filter(event => new Date(event.timestamp) >= oneHourAgo && event.severity === 'critical').length;

    const eventsBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    const eventsByType: Record<string, number> = {};
    const userTargets: Record<string, number> = {};
    let totalRiskScore = 0;

    for (const event of events24h) {
      eventsBySeverity[event.severity]++;
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      totalRiskScore += event.risk_score;

      if (event.userId && event.userEmail) {
        const key = `${event.userId}:${event.userEmail}`;
        userTargets[key] = (userTargets[key] || 0) + 1;
      }
    }

    const uniqueIPs = new Set(events24h.map(e => e.ipAddress).filter(Boolean)).size;
    const suspiciousIPs = Array.from(this.suspiciousIPs.entries())
      .filter(([_, data]) => data.count >= 5)
      .map(([ip]) => ip)
      .slice(0, 10);

    const topTargetedUsers = Object.entries(userTargets)
      .map(([key, count]) => {
        const [userId, email] = key.split(':');
        return { userId: parseInt(userId), email, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      timestamp: new Date().toISOString(),
      totalEvents: events24h.length,
      eventsBySeverity,
      eventsByType,
      uniqueIPs,
      suspiciousIPs,
      topTargetedUsers,
      recentAlerts,
      riskScore: events24h.length > 0 ? Math.round((totalRiskScore / events24h.length) * 10) / 10 : 0
    };
  }

  /**
   * Get suspicious IP addresses
   */
  getSuspiciousIPs(minEvents: number = 5): Array<{
    ip: string;
    eventCount: number;
    lastSeen: Date;
    eventTypes: SecurityEventType[];
  }> {
    return Array.from(this.suspiciousIPs.entries())
      .filter(([_, data]) => data.count >= minEvents)
      .map(([ip, data]) => ({
        ip,
        eventCount: data.count,
        lastSeen: data.lastSeen,
        eventTypes: [...new Set(data.events)]
      }))
      .sort((a, b) => b.eventCount - a.eventCount);
  }

  /**
   * Block suspicious IP (placeholder for actual IP blocking implementation)
   */
  blockSuspiciousIP(ipAddress: string, reason: string): void {
    logger.security('IP blocked for suspicious activity', {
      ipAddress,
      reason,
      action: 'ip_block'
    });

    // In a real implementation, this would integrate with:
    // - Cloudflare
    // - AWS WAF
    // - Nginx/Apache config
    // - Firewall rules
  }

  /**
   * Clean up old security events
   */
  cleanupOldEvents(olderThanHours: number = 168): number { // Default 7 days
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.events.length;
    
    this.events = this.events.filter(event => new Date(event.timestamp) >= cutoff);
    
    // Clean up IP tracking
    for (const [ip, data] of this.suspiciousIPs) {
      if (data.lastSeen < cutoff) {
        this.suspiciousIPs.delete(ip);
      }
    }

    // Clean up failed login tracking
    for (const [key, data] of this.failedLoginAttempts) {
      if (data.lastAttempt < cutoff) {
        this.failedLoginAttempts.delete(key);
      }
    }

    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      logger.info('Cleaned up old security events', {
        removed: removedCount,
        olderThanHours,
        suspiciousIPs: this.suspiciousIPs.size
      });
    }

    return removedCount;
  }

  /**
   * Reset all security data (for testing)
   */
  reset(): void {
    this.events = [];
    this.suspiciousIPs.clear();
    this.failedLoginAttempts.clear();
    logger.info('Security monitor reset');
  }
}

export const securityMonitor = new SecurityMonitor();