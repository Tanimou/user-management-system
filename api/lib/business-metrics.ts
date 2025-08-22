/**
 * Business metrics tracking for user management system
 */

import { logger, LogContext } from './logger.js';
import { prisma } from './prisma.js';

export interface BusinessMetric {
  id: string;
  timestamp: string;
  metric: string;
  value: number;
  unit: string;
  labels?: Record<string, string>;
  metadata?: any;
}

export interface BusinessMetricsSummary {
  timestamp: string;
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    adminUsers: number;
    regularUsers: number;
  };
  authMetrics: {
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    uniqueActiveUsers: number;
    loginSuccessRate: number;
  };
  systemMetrics: {
    totalApiRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    errorRate: number;
  };
  securityMetrics: {
    suspiciousActivity: number;
    blockedRequests: number;
    passwordResets: number;
    accountLockouts: number;
  };
}

class BusinessMetricsTracker {
  private metrics: Map<string, BusinessMetric[]> = new Map();
  private maxMetricsPerType = 10000;

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record a business metric
   */
  recordMetric(
    metric: string,
    value: number,
    unit: string = 'count',
    labels?: Record<string, string>,
    metadata?: any
  ): void {
    const businessMetric: BusinessMetric = {
      id: this.generateMetricId(),
      timestamp: new Date().toISOString(),
      metric,
      value,
      unit,
      labels,
      metadata
    };

    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const metricArray = this.metrics.get(metric)!;
    metricArray.push(businessMetric);

    // Keep only recent metrics
    if (metricArray.length > this.maxMetricsPerType) {
      metricArray.shift();
    }

    // Log business metric
    logger.business(`Business metric recorded: ${metric}`, {
      metric,
      value,
      unit,
      labels,
      metricId: businessMetric.id
    });
  }

  /**
   * Track user registration
   */
  trackUserRegistration(userId: number, userRoles: string[], context?: LogContext): void {
    this.recordMetric('user_registration', 1, 'count', {
      roles: userRoles.join(',')
    }, { userId });

    // Track admin registration separately
    if (userRoles.includes('admin')) {
      this.recordMetric('admin_user_registration', 1, 'count', {}, { userId });
    }

    logger.business('User registered', {
      ...context,
      userId,
      roles: userRoles
    });
  }

  /**
   * Track user login
   */
  trackUserLogin(userId: number, success: boolean, method: string = 'password', context?: LogContext): void {
    this.recordMetric('user_login_attempt', 1, 'count', {
      success: success.toString(),
      method
    }, { userId });

    if (success) {
      this.recordMetric('successful_login', 1, 'count', { method }, { userId });
      logger.business('User login successful', {
        ...context,
        userId,
        method
      });
    } else {
      this.recordMetric('failed_login', 1, 'count', { method }, { userId });
      logger.security('User login failed', {
        ...context,
        userId,
        method
      });
    }
  }

  /**
   * Track user logout
   */
  trackUserLogout(userId: number, context?: LogContext): void {
    this.recordMetric('user_logout', 1, 'count', {}, { userId });
    logger.business('User logged out', { ...context, userId });
  }

  /**
   * Track password reset
   */
  trackPasswordReset(userId?: number, email?: string, context?: LogContext): void {
    this.recordMetric('password_reset_request', 1, 'count', {}, { userId, email });
    logger.security('Password reset requested', {
      ...context,
      userId,
      email: email ? email.substring(0, 3) + '***' : undefined // Masked for privacy
    });
  }

  /**
   * Track user status change
   */
  trackUserStatusChange(userId: number, oldStatus: boolean, newStatus: boolean, context?: LogContext): void {
    const action = newStatus ? 'activation' : 'deactivation';
    this.recordMetric(`user_${action}`, 1, 'count', {}, { userId });

    logger.business(`User ${action}`, {
      ...context,
      userId,
      oldStatus,
      newStatus
    });
  }

  /**
   * Track role changes
   */
  trackRoleChange(userId: number, oldRoles: string[], newRoles: string[], context?: LogContext): void {
    this.recordMetric('role_change', 1, 'count', {
      oldRoles: oldRoles.join(','),
      newRoles: newRoles.join(',')
    }, { userId });

    logger.business('User role changed', {
      ...context,
      userId,
      oldRoles,
      newRoles
    });
  }

  /**
   * Track API endpoint usage
   */
  trackApiEndpoint(endpoint: string, method: string, statusCode: number, responseTime: number, context?: LogContext): void {
    this.recordMetric('api_request', 1, 'count', {
      endpoint,
      method,
      statusCode: statusCode.toString()
    }, { responseTime });

    this.recordMetric('api_response_time', responseTime, 'milliseconds', {
      endpoint,
      method
    });

    if (statusCode >= 400) {
      this.recordMetric('api_error', 1, 'count', {
        endpoint,
        method,
        statusCode: statusCode.toString()
      });
    }
  }

  /**
   * Track security events
   */
  trackSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', context?: LogContext): void {
    this.recordMetric('security_event', 1, 'count', {
      event,
      severity
    }, context);

    logger.security(`Security event: ${event}`, {
      ...context,
      event,
      severity
    });
  }

  /**
   * Get metrics for a specific type
   */
  getMetrics(metricName: string, limit: number = 100): BusinessMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.slice(-limit).reverse(); // Return most recent first
  }

  /**
   * Get aggregated metrics for a time period
   */
  getAggregatedMetrics(metricName: string, hoursBack: number = 24): {
    total: number;
    average: number;
    min: number;
    max: number;
    count: number;
  } {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const metrics = (this.metrics.get(metricName) || [])
      .filter(m => new Date(m.timestamp) >= cutoffTime);

    if (metrics.length === 0) {
      return { total: 0, average: 0, min: 0, max: 0, count: 0 };
    }

    const values = metrics.map(m => m.value);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { total, average, min, max, count: values.length };
  }

  /**
   * Generate comprehensive business metrics summary
   */
  async generateBusinessMetricsSummary(): Promise<BusinessMetricsSummary> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // User metrics from database
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        adminUsers,
        regularUsers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
        prisma.user.count({ where: { roles: { has: 'admin' } } }),
        prisma.user.count({ where: { roles: { equals: ['user'] } } })
      ]);

      // Auth metrics from tracked data
      const totalLogins = this.getAggregatedMetrics('user_login_attempt', 24).total;
      const successfulLogins = this.getAggregatedMetrics('successful_login', 24).total;
      const failedLogins = this.getAggregatedMetrics('failed_login', 24).total;
      const loginSuccessRate = totalLogins > 0 ? (successfulLogins / totalLogins) * 100 : 0;

      // System metrics
      const apiRequests = this.getAggregatedMetrics('api_request', 24);
      const apiErrors = this.getAggregatedMetrics('api_error', 24);
      const responseTime = this.getAggregatedMetrics('api_response_time', 24);

      // Security metrics
      const securityEvents = this.getAggregatedMetrics('security_event', 24);
      const passwordResets = this.getAggregatedMetrics('password_reset_request', 24);

      return {
        timestamp: new Date().toISOString(),
        userMetrics: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
          adminUsers,
          regularUsers
        },
        authMetrics: {
          totalLogins,
          successfulLogins,
          failedLogins,
          uniqueActiveUsers: successfulLogins, // Simplified - could be more accurate
          loginSuccessRate: Math.round(loginSuccessRate * 100) / 100
        },
        systemMetrics: {
          totalApiRequests: apiRequests.total,
          successfulRequests: apiRequests.total - apiErrors.total,
          failedRequests: apiErrors.total,
          averageResponseTime: Math.round(responseTime.average),
          errorRate: apiRequests.total > 0 ? Math.round((apiErrors.total / apiRequests.total) * 100 * 100) / 100 : 0
        },
        securityMetrics: {
          suspiciousActivity: securityEvents.total,
          blockedRequests: 0, // Would be tracked by rate limiter
          passwordResets: passwordResets.total,
          accountLockouts: 0 // Would be tracked by account lockout system
        }
      };
    } catch (error) {
      logger.error('Failed to generate business metrics summary', error);
      throw error;
    }
  }

  /**
   * Get top metrics by type
   */
  getTopMetrics(limit: number = 10): Array<{
    metric: string;
    totalValue: number;
    recentValue: number; // last hour
    trend: 'up' | 'down' | 'stable';
  }> {
    const result: Array<{
      metric: string;
      totalValue: number;
      recentValue: number;
      trend: 'up' | 'down' | 'stable';
    }> = [];

    for (const [metricName] of this.metrics) {
      const total24h = this.getAggregatedMetrics(metricName, 24);
      const recent1h = this.getAggregatedMetrics(metricName, 1);
      const previous1h = this.getAggregatedMetrics(metricName, 2).total - recent1h.total;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (recent1h.total > previous1h * 1.1) trend = 'up';
      else if (recent1h.total < previous1h * 0.9) trend = 'down';

      result.push({
        metric: metricName,
        totalValue: total24h.total,
        recentValue: recent1h.total,
        trend
      });
    }

    return result
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit);
  }

  /**
   * Get all tracked metric names
   */
  getTrackedMetrics(): string[] {
    return Array.from(this.metrics.keys()).sort();
  }

  /**
   * Clear old metrics (cleanup)
   */
  clearOldMetrics(olderThanHours: number = 168): number { // Default 7 days
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let totalRemoved = 0;

    for (const [metricName, metricArray] of this.metrics) {
      const initialLength = metricArray.length;
      const filtered = metricArray.filter(m => new Date(m.timestamp) >= cutoffTime);
      this.metrics.set(metricName, filtered);
      totalRemoved += initialLength - filtered.length;
    }

    if (totalRemoved > 0) {
      logger.info('Cleared old business metrics', { 
        removed: totalRemoved, 
        olderThanHours,
        metricsTypes: this.metrics.size 
      });
    }

    return totalRemoved;
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(metricNames?: string[], hoursBack: number = 24): BusinessMetric[] {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const allMetrics: BusinessMetric[] = [];

    const metricsToExport = metricNames || Array.from(this.metrics.keys());

    for (const metricName of metricsToExport) {
      const metrics = this.metrics.get(metricName) || [];
      const filteredMetrics = metrics.filter(m => new Date(m.timestamp) >= cutoffTime);
      allMetrics.push(...filteredMetrics);
    }

    return allMetrics.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    logger.info('All business metrics cleared');
  }
}

export const businessMetrics = new BusinessMetricsTracker();