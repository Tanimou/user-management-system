/**
 * Alert system for monitoring and notifications
 */

import { logger, LogContext } from './logger.js';
import { PerformanceMetrics } from './performance-monitor.js';
import { ErrorReport } from './error-tracking.js';

export interface Alert {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  source: 'system' | 'database' | 'api' | 'security';
  metadata?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: (data: any) => boolean;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  source: 'system' | 'database' | 'api' | 'security';
  throttleMinutes?: number;
}

class AlertSystem {
  private alerts: Alert[] = [];
  private alertHistory: Map<string, Date> = new Map();
  private maxAlerts = 1000;

  private rules: AlertRule[] = [
    // Database performance rules
    {
      id: 'db-response-time-critical',
      name: 'Database Response Time Critical',
      enabled: true,
      condition: (metrics: PerformanceMetrics) => metrics.responseTime > 5000,
      severity: 'critical',
      title: 'Database Response Time Critical',
      message: 'Database response time is critically high',
      source: 'database',
      throttleMinutes: 5
    },
    {
      id: 'db-response-time-warning',
      name: 'Database Response Time Warning',
      enabled: true,
      condition: (metrics: PerformanceMetrics) => metrics.responseTime > 2000 && metrics.responseTime <= 5000,
      severity: 'warning',
      title: 'Database Response Time Warning',
      message: 'Database response time is elevated',
      source: 'database',
      throttleMinutes: 10
    },
    {
      id: 'db-connection-pool-critical',
      name: 'Database Connection Pool Critical',
      enabled: true,
      condition: (metrics: PerformanceMetrics) => metrics.connectionPoolUsage > 90,
      severity: 'critical',
      title: 'Connection Pool Critical',
      message: 'Database connection pool usage is critically high',
      source: 'database',
      throttleMinutes: 5
    },
    {
      id: 'db-slow-queries',
      name: 'High Slow Query Count',
      enabled: true,
      condition: (metrics: PerformanceMetrics) => metrics.slowQueries > 20,
      severity: 'warning',
      title: 'High Slow Query Count',
      message: 'High number of slow queries detected',
      source: 'database',
      throttleMinutes: 15
    },
    // System performance rules
    {
      id: 'memory-usage-critical',
      name: 'Memory Usage Critical',
      enabled: true,
      condition: (data: { heapUsedMB: number }) => data.heapUsedMB > 1024,
      severity: 'critical',
      title: 'Memory Usage Critical',
      message: 'System memory usage is critically high',
      source: 'system',
      throttleMinutes: 5
    },
    // Error rate rules
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      enabled: true,
      condition: (data: { errorCount: number; timeWindowMinutes: number }) => {
        const errorRate = data.errorCount / data.timeWindowMinutes;
        return errorRate > 10; // More than 10 errors per minute
      },
      severity: 'warning',
      title: 'High Error Rate',
      message: 'System is experiencing a high error rate',
      source: 'system',
      throttleMinutes: 10
    },
    // Security rules
    {
      id: 'failed-login-attempts',
      name: 'High Failed Login Attempts',
      enabled: true,
      condition: (data: { failedAttempts: number; timeWindowMinutes: number }) => {
        const attemptRate = data.failedAttempts / data.timeWindowMinutes;
        return attemptRate > 5; // More than 5 failed attempts per minute
      },
      severity: 'warning',
      title: 'High Failed Login Attempts',
      message: 'Multiple failed login attempts detected',
      source: 'security',
      throttleMinutes: 5
    }
  ];

  /**
   * Generate a unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if alert should be throttled
   */
  private isThrottled(ruleId: string, throttleMinutes: number = 0): boolean {
    if (throttleMinutes === 0) return false;
    
    const lastAlert = this.alertHistory.get(ruleId);
    if (!lastAlert) return false;
    
    const now = new Date();
    const timeDiff = (now.getTime() - lastAlert.getTime()) / (1000 * 60); // minutes
    return timeDiff < throttleMinutes;
  }

  /**
   * Create and fire an alert
   */
  createAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Alert {
    const newAlert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      ...alert
    };

    this.alerts.push(newAlert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Log the alert
    logger.warn('Alert triggered', {
      alertId: newAlert.id,
      severity: newAlert.severity,
      title: newAlert.title,
      source: newAlert.source,
      metadata: newAlert.metadata
    });

    // Send notifications
    this.sendNotifications(newAlert);

    return newAlert;
  }

  /**
   * Evaluate all alert rules against provided data
   */
  evaluateRules(data: any, dataType: 'performance' | 'error' | 'security' | 'system'): Alert[] {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check if rule is throttled
      if (this.isThrottled(rule.id, rule.throttleMinutes)) {
        continue;
      }

      try {
        if (rule.condition(data)) {
          const alert = this.createAlert({
            severity: rule.severity,
            title: rule.title,
            message: rule.message,
            source: rule.source,
            metadata: { ruleId: rule.id, data, dataType }
          });

          triggeredAlerts.push(alert);

          // Update throttle timestamp
          this.alertHistory.set(rule.id, new Date());
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule ${rule.id}`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    try {
      // Console notification (always active)
      const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${emoji} ALERT [${alert.severity.toUpperCase()}]: ${alert.title} - ${alert.message}`);

      // Webhook notifications
      await this.sendWebhookNotifications(alert);

      // Email notifications
      await this.sendEmailNotifications(alert);

      // Additional notification channels can be added here

    } catch (error) {
      logger.error('Failed to send alert notifications', error, {
        alertId: alert.id,
        title: alert.title
      });
    }
  }

  /**
   * Send webhook notifications (Slack, Discord, etc.)
   */
  private async sendWebhookNotifications(alert: Alert): Promise<void> {
    const webhooks = this.getConfiguredWebhooks(alert.severity);
    
    for (const webhook of webhooks) {
      try {
        const payload = {
          text: `${alert.title}: ${alert.message}`,
          severity: alert.severity,
          timestamp: alert.timestamp,
          source: alert.source,
          metadata: alert.metadata
        };

        // For Slack format
        if (webhook.type === 'slack') {
          const slackPayload = {
            text: `Alert: ${alert.title}`,
            attachments: [
              {
                color: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good',
                fields: [
                  { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                  { title: 'Source', value: alert.source, short: true },
                  { title: 'Message', value: alert.message, short: false },
                  { title: 'Time', value: alert.timestamp, short: true }
                ]
              }
            ]
          };

          await this.sendWebhook(webhook.url, slackPayload);
        } else {
          // Generic webhook format
          await this.sendWebhook(webhook.url, payload);
        }
      } catch (error) {
        logger.error(`Failed to send webhook notification to ${webhook.type}`, error);
      }
    }
  }

  /**
   * Send email notifications
   */
  private async sendEmailNotifications(alert: Alert): Promise<void> {
    const emailConfig = this.getEmailConfig(alert.severity);
    
    if (!emailConfig.enabled) return;

    try {
      // Placeholder for email sending logic
      // In a real implementation, you would integrate with an email service
      logger.info('Email alert notification would be sent', {
        to: emailConfig.recipients,
        subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        body: alert.message
      });
    } catch (error) {
      logger.error('Failed to send email notification', error);
    }
  }

  /**
   * Send webhook request
   */
  private async sendWebhook(url: string, payload: any): Promise<void> {
    if (typeof fetch === 'undefined') {
      // For Node.js environments without fetch
      logger.warn('Webhook notification skipped - fetch not available', { url });
      return;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  /**
   * Get configured webhooks for severity level
   */
  private getConfiguredWebhooks(severity: string): Array<{ type: string; url: string }> {
    const webhooks: Array<{ type: string; url: string }> = [];

    if (process.env.SLACK_WEBHOOK_URL) {
      webhooks.push({ type: 'slack', url: process.env.SLACK_WEBHOOK_URL });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      webhooks.push({ type: 'discord', url: process.env.DISCORD_WEBHOOK_URL });
    }

    if (process.env.GENERIC_WEBHOOK_URL) {
      webhooks.push({ type: 'generic', url: process.env.GENERIC_WEBHOOK_URL });
    }

    // Filter based on severity if configured
    if (severity === 'info' && process.env.ALERT_INFO_WEBHOOKS_DISABLED === 'true') {
      return [];
    }

    return webhooks;
  }

  /**
   * Get email configuration for severity level
   */
  private getEmailConfig(severity: string): { enabled: boolean; recipients: string[] } {
    const config = {
      enabled: false,
      recipients: [] as string[]
    };

    if (process.env.ALERT_EMAIL_ENABLED === 'true' && process.env.ALERT_EMAIL_RECIPIENTS) {
      config.enabled = true;
      config.recipients = process.env.ALERT_EMAIL_RECIPIENTS.split(',').map(email => email.trim());
    }

    // Disable email for info level alerts unless explicitly enabled
    if (severity === 'info' && process.env.ALERT_INFO_EMAILS_ENABLED !== 'true') {
      config.enabled = false;
    }

    return config;
  }

  /**
   * Get all alerts with optional filtering
   */
  getAlerts(options: {
    severity?: 'info' | 'warning' | 'critical';
    source?: 'system' | 'database' | 'api' | 'security';
    limit?: number;
    since?: string;
  } = {}): Alert[] {
    let alerts = [...this.alerts];

    // Apply filters
    if (options.severity) {
      alerts = alerts.filter(alert => alert.severity === options.severity);
    }

    if (options.source) {
      alerts = alerts.filter(alert => alert.source === options.source);
    }

    if (options.since) {
      const sinceDate = new Date(options.since);
      alerts = alerts.filter(alert => new Date(alert.timestamp) >= sinceDate);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    recentCount: number;
  } {
    const stats = {
      total: this.alerts.length,
      bySeverity: { info: 0, warning: 0, critical: 0 },
      bySource: { system: 0, database: 0, api: 0, security: 0 },
      recentCount: 0
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const alert of this.alerts) {
      stats.bySeverity[alert.severity]++;
      stats.bySource[alert.source]++;
      
      if (new Date(alert.timestamp) >= oneHourAgo) {
        stats.recentCount++;
      }
    }

    return stats;
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Enable/disable alert rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      logger.info('Alert rule updated', { ruleId, enabled });
    }
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return [...this.rules];
  }

  /**
   * Clear old alerts (cleanup)
   */
  clearOldAlerts(olderThanHours: number = 24): number {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.alerts.length;
    
    this.alerts = this.alerts.filter(alert => new Date(alert.timestamp) >= cutoffDate);
    
    const removedCount = initialCount - this.alerts.length;
    if (removedCount > 0) {
      logger.info('Cleared old alerts', { removed: removedCount, olderThanHours });
    }
    
    return removedCount;
  }

  /**
   * Reset all alerts and history (useful for testing)
   */
  reset(): void {
    this.alerts = [];
    this.alertHistory.clear();
  }
}

export const alertSystem = new AlertSystem();