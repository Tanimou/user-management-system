import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: number;
  email?: string;
  action?: string;
  resource?: string;
  ip?: string | string[];
  userAgent?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      ...(process.env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard'
          }
        }
      })
    });
  }

  private formatMessage(message: string, context?: LogContext): any {
    return {
      message,
      ...context,
      environment: process.env.NODE_ENV,
      service: 'user-management-api',
      // Normalize IP to string
      ...(context?.ip && { ip: Array.isArray(context.ip) ? context.ip[0] : context.ip })
    };
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.formatMessage(message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.formatMessage(message, context));
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorInfo = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error.code && { code: error.code }),
        ...(error.status && { status: error.status })
      }
    } : {};

    this.logger.error({
      ...this.formatMessage(message, context),
      ...errorInfo
    });
  }

  // Security event logging
  security(event: string, context: LogContext): void {
    this.logger.warn({
      ...this.formatMessage(`SECURITY: ${event}`, context),
      securityEvent: true,
      event
    });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    this.logger.info({
      ...this.formatMessage(`PERF: ${operation}`, { ...context, duration }),
      performance: true,
      operation,
      duration
    });
  }

  // Business event logging
  business(event: string, context: LogContext): void {
    this.logger.info({
      ...this.formatMessage(`BUSINESS: ${event}`, context),
      businessEvent: true,
      event
    });
  }
}

export const logger = new Logger();