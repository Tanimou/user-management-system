import { prisma } from './prisma.js';
import DatabaseMonitor from './db-monitoring.js';

export interface PerformanceThresholds {
  responseTime: number; // milliseconds
  connectionPoolUsage: number; // percentage
  errorRate: number; // percentage
  queryExecutionTime: number; // milliseconds
}

export interface PerformanceMetrics {
  timestamp: string;
  responseTime: number;
  connectionPoolUsage: number;
  activeConnections: number;
  totalConnections: number;
  databaseSize: string;
  slowQueries: number;
  errors: string[];
  status: 'healthy' | 'warning' | 'critical';
}

export interface AlertCondition {
  metric: keyof PerformanceMetrics;
  threshold: number;
  comparison: 'greater_than' | 'less_than' | 'equals';
  severity: 'warning' | 'critical';
  message: string;
}

export class PerformanceMonitor {
  private static readonly DEFAULT_THRESHOLDS: PerformanceThresholds = {
    responseTime: 1000, // 1 second
    connectionPoolUsage: 80, // 80%
    errorRate: 1, // 1%
    queryExecutionTime: 500, // 500ms
  };

  private static readonly ALERT_CONDITIONS: AlertCondition[] = [
    {
      metric: 'responseTime',
      threshold: 2000,
      comparison: 'greater_than',
      severity: 'critical',
      message: 'Database response time is critically high'
    },
    {
      metric: 'responseTime',
      threshold: 1000,
      comparison: 'greater_than',
      severity: 'warning',
      message: 'Database response time is elevated'
    },
    {
      metric: 'connectionPoolUsage',
      threshold: 90,
      comparison: 'greater_than',
      severity: 'critical',
      message: 'Connection pool usage is critically high'
    },
    {
      metric: 'connectionPoolUsage',
      threshold: 80,
      comparison: 'greater_than',
      severity: 'warning',
      message: 'Connection pool usage is high'
    },
    {
      metric: 'slowQueries',
      threshold: 10,
      comparison: 'greater_than',
      severity: 'warning',
      message: 'High number of slow queries detected'
    }
  ];

  /**
   * Collect comprehensive performance metrics
   */
  static async collectMetrics(): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // Test basic connectivity and measure response time
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      // Get connection pool information
      const connectionPool = await DatabaseMonitor.getConnectionPoolStatus();
      const connectionPoolUsage = connectionPool.maxConnections 
        ? (connectionPool.totalConnections / connectionPool.maxConnections) * 100
        : 0;

      // Get database size
      const databaseSize = await DatabaseMonitor.getDatabaseSize();

      // Get slow queries count
      const slowQueries = await DatabaseMonitor.getSlowQueries(50);

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      // Check against thresholds
      if (responseTime > this.DEFAULT_THRESHOLDS.responseTime) {
        status = responseTime > 2000 ? 'critical' : 'warning';
      }
      
      if (connectionPoolUsage > this.DEFAULT_THRESHOLDS.connectionPoolUsage) {
        status = connectionPoolUsage > 90 ? 'critical' : 'warning';
      }

      return {
        timestamp: new Date().toISOString(),
        responseTime,
        connectionPoolUsage: Math.round(connectionPoolUsage * 100) / 100,
        activeConnections: connectionPool.activeConnections,
        totalConnections: connectionPool.totalConnections,
        databaseSize,
        slowQueries: slowQueries.length,
        errors,
        status
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        connectionPoolUsage: 0,
        activeConnections: 0,
        totalConnections: 0,
        databaseSize: 'Unknown',
        slowQueries: 0,
        errors,
        status: 'critical'
      };
    }
  }

  /**
   * Check metrics against alert conditions
   */
  static checkAlertConditions(metrics: PerformanceMetrics): {
    alerts: Array<{ severity: string; message: string; value: any }>;
    hasAlerts: boolean;
  } {
    const alerts: Array<{ severity: string; message: string; value: any }> = [];

    for (const condition of this.ALERT_CONDITIONS) {
      const value = metrics[condition.metric];
      let triggered = false;

      if (typeof value === 'number') {
        switch (condition.comparison) {
          case 'greater_than':
            triggered = value > condition.threshold;
            break;
          case 'less_than':
            triggered = value < condition.threshold;
            break;
          case 'equals':
            triggered = value === condition.threshold;
            break;
        }
      }

      if (triggered) {
        alerts.push({
          severity: condition.severity,
          message: condition.message,
          value
        });
      }
    }

    return {
      alerts,
      hasAlerts: alerts.length > 0
    };
  }

  /**
   * Generate performance report with recommendations
   */
  static async generatePerformanceReport(): Promise<{
    metrics: PerformanceMetrics;
    alerts: Array<{ severity: string; message: string; value: any }>;
    recommendations: string[];
    healthScore: number;
  }> {
    const metrics = await this.collectMetrics();
    const { alerts } = this.checkAlertConditions(metrics);
    const recommendations: string[] = [];

    // Generate recommendations based on metrics
    if (metrics.responseTime > 1000) {
      recommendations.push('Consider optimizing database queries or adding indexes');
      recommendations.push('Review connection pool configuration');
    }

    if (metrics.connectionPoolUsage > 80) {
      recommendations.push('Consider increasing connection pool size');
      recommendations.push('Review connection usage patterns and implement connection reuse');
    }

    if (metrics.slowQueries > 5) {
      recommendations.push('Investigate and optimize slow queries');
      recommendations.push('Consider adding database indexes for frequently queried columns');
    }

    if (metrics.errors.length > 0) {
      recommendations.push('Review and fix database connectivity issues');
      recommendations.push('Check database server resources and availability');
    }

    // Calculate health score (0-100)
    let healthScore = 100;
    if (metrics.responseTime > 500) healthScore -= 10;
    if (metrics.responseTime > 1000) healthScore -= 20;
    if (metrics.connectionPoolUsage > 70) healthScore -= 15;
    if (metrics.connectionPoolUsage > 85) healthScore -= 25;
    if (metrics.slowQueries > 5) healthScore -= 10;
    if (metrics.errors.length > 0) healthScore -= 30;
    
    healthScore = Math.max(0, healthScore);

    return {
      metrics,
      alerts,
      recommendations,
      healthScore
    };
  }

  /**
   * Run automated performance tests
   */
  static async runPerformanceTests(): Promise<{
    testResults: Record<string, number>;
    baseline: Record<string, number>;
    performance: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  }> {
    const testResults = await DatabaseMonitor.performanceTest();
    
    // Define baseline performance expectations (milliseconds)
    const baseline = {
      simpleQuery: 50,      // Simple SELECT 1
      complexQuery: 200,    // User list query with joins
      insertTest: 100,      // Insert audit log record
    };

    // Calculate performance rating
    let performanceScore = 0;
    let totalTests = 0;

    for (const [test, result] of Object.entries(testResults)) {
      const baselineValue = baseline[test as keyof typeof baseline];
      if (baselineValue) {
        totalTests++;
        if (result <= baselineValue) {
          performanceScore += 4; // Excellent
        } else if (result <= baselineValue * 2) {
          performanceScore += 3; // Good
        } else if (result <= baselineValue * 3) {
          performanceScore += 2; // Fair
        } else {
          performanceScore += 1; // Poor
        }
      }
    }

    const averageScore = totalTests > 0 ? performanceScore / totalTests : 0;
    let performance: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (averageScore >= 3.5) performance = 'excellent';
    else if (averageScore >= 2.5) performance = 'good';
    else if (averageScore >= 1.5) performance = 'fair';
    else performance = 'poor';

    // Generate specific recommendations
    const recommendations: string[] = [];
    
    if (testResults.simpleQuery > baseline.simpleQuery * 2) {
      recommendations.push('Basic query performance is slow - check database server resources');
    }
    
    if (testResults.complexQuery > baseline.complexQuery * 2) {
      recommendations.push('Complex queries are slow - review indexes and query optimization');
    }
    
    if (testResults.insertTest > baseline.insertTest * 2) {
      recommendations.push('Insert performance is slow - check disk I/O and transaction settings');
    }

    return {
      testResults,
      baseline,
      performance,
      recommendations
    };
  }

  /**
   * Monitor database health continuously
   */
  static async startMonitoring(intervalMs: number = 60000): Promise<void> {
    console.log(`📊 Starting database performance monitoring (interval: ${intervalMs}ms)`);
    
    const monitor = async () => {
      try {
        const metrics = await this.collectMetrics();
        const { alerts, hasAlerts } = this.checkAlertConditions(metrics);
        
        if (hasAlerts) {
          console.warn(`⚠️  Database alerts detected:`, alerts);
          // Here you could integrate with alerting systems like:
          // - Slack webhooks
          // - Email notifications
          // - PagerDuty
          // - Sentry
          await this.sendAlerts(alerts, metrics);
        }
        
        // Log metrics for analysis
        console.log(`📊 Database metrics - Status: ${metrics.status}, Response: ${metrics.responseTime}ms, Pool: ${metrics.connectionPoolUsage}%`);
        
      } catch (error) {
        console.error('❌ Monitoring error:', error);
      }
    };

    // Initial run
    await monitor();
    
    // Set up interval
    setInterval(monitor, intervalMs);
  }

  /**
   * Send alerts to configured systems
   */
  private static async sendAlerts(alerts: Array<{ severity: string; message: string; value: any }>, metrics: PerformanceMetrics): Promise<void> {
    // This is where you'd integrate with your alerting systems
    // Examples:
    
    // Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(alerts, metrics);
    }
    
    // Email notifications
    if (process.env.ALERT_EMAIL) {
      await this.sendEmailAlert(alerts, metrics);
    }
    
    // Sentry error tracking
    if (process.env.SENTRY_DSN) {
      await this.sendSentryAlert(alerts, metrics);
    }
  }

  private static async sendSlackAlert(alerts: Array<{ severity: string; message: string; value: any }>, metrics: PerformanceMetrics): Promise<void> {
    // Slack integration placeholder
    console.log('📢 Would send Slack alert:', { alerts, metrics });
  }

  private static async sendEmailAlert(alerts: Array<{ severity: string; message: string; value: any }>, metrics: PerformanceMetrics): Promise<void> {
    // Email integration placeholder
    console.log('📧 Would send email alert:', { alerts, metrics });
  }

  private static async sendSentryAlert(alerts: Array<{ severity: string; message: string; value: any }>, metrics: PerformanceMetrics): Promise<void> {
    // Sentry integration placeholder
    console.log('🐛 Would send Sentry alert:', { alerts, metrics });
  }
}

export default PerformanceMonitor;