export interface UserExperienceMetrics {
  sessionId: string;
  userId?: number;
  pageViews: number;
  timeOnSite: number;
  interactions: number;
  errors: number;
  performance: {
    averagePageLoad: number;
    averageApiResponse: number;
    slowPages: string[];
  };
}

export interface ErrorBoundaryInfo {
  errorId: string;
  timestamp: string;
  component: string;
  error: string;
  stack?: string;
  userId?: number;
  page: string;
  userAgent: string;
}

class FrontendMonitor {
  private metrics: Map<string, number[]> = new Map();
  private sessionId: string;
  private sessionStartTime: number;
  private userId?: number;
  private pageViews: number = 0;
  private interactions: number = 0;
  private errors: number = 0;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.initializeErrorTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(event.error, 'global_error', window.location.pathname);
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), 'unhandled_promise', window.location.pathname);
    });
  }

  setUserId(userId: number): void {
    this.userId = userId;
  }

  trackPageLoad(page: string, loadTime: number): void {
    this.recordMetric(`page_load_${page}`, loadTime);
    this.pageViews++;
    
    if (loadTime > 3000) {
      console.warn(`Slow page load detected: ${page} took ${loadTime}ms`);
      this.trackError(new Error(`Slow page load: ${loadTime}ms`), 'performance', page);
    }

    // Track page view in business metrics
    this.recordMetric('page_view', 1);
  }

  trackApiCall(endpoint: string, duration: number, status: number): void {
    this.recordMetric(`api_${endpoint.replace(/\//g, '_')}`, duration);
    
    if (status >= 400) {
      this.recordMetric(`api_errors_${status}`, 1);
      this.errors++;
      
      // Track API errors
      this.trackError(
        new Error(`API Error: ${status} on ${endpoint}`),
        'api_error',
        window.location.pathname
      );
    }

    if (duration > 5000) {
      console.warn(`Slow API call detected: ${endpoint} took ${duration}ms`);
    }
  }

  trackUserAction(action: string, duration?: number): void {
    this.recordMetric(`user_action_${action}`, duration || 1);
    this.interactions++;
    
    // Track engagement metrics
    if (action === 'click') {
      this.recordMetric('user_clicks', 1);
    } else if (action === 'form_submit') {
      this.recordMetric('form_submissions', 1);
    } else if (action === 'search') {
      this.recordMetric('searches', 1);
    }
  }

  trackError(error: Error, type: string, page: string): void {
    const errorInfo: ErrorBoundaryInfo = {
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      component: type,
      error: error.message,
      stack: error.stack,
      userId: this.userId,
      page,
      userAgent: navigator.userAgent
    };

    this.recordMetric(`error_${type}`, 1);
    this.errors++;

    // Send error to backend immediately
    this.sendErrorReport(errorInfo);
  }

  trackUserExperience(): UserExperienceMetrics {
    const pageLoadMetrics = this.getMetrics();
    const averagePageLoad = this.calculateAverageMetric('page_load');
    const averageApiResponse = this.calculateAverageMetric('api');
    const slowPages = this.getSlowPages();

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      pageViews: this.pageViews,
      timeOnSite: Math.round((Date.now() - this.sessionStartTime) / 1000),
      interactions: this.interactions,
      errors: this.errors,
      performance: {
        averagePageLoad,
        averageApiResponse,
        slowPages
      }
    };
  }

  private calculateAverageMetric(prefix: string): number {
    const relevantMetrics = Array.from(this.metrics.entries())
      .filter(([name]) => name.startsWith(prefix))
      .flatMap(([_, values]) => values);

    if (relevantMetrics.length === 0) return 0;
    
    return Math.round(
      relevantMetrics.reduce((sum, val) => sum + val, 0) / relevantMetrics.length
    );
  }

  private getSlowPages(): string[] {
    const slowPages: string[] = [];
    
    for (const [metricName, values] of this.metrics.entries()) {
      if (metricName.startsWith('page_load_')) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        if (average > 3000) {
          const pageName = metricName.replace('page_load_', '');
          slowPages.push(pageName);
        }
      }
    }
    
    return slowPages;
  }

  private async sendErrorReport(errorInfo: ErrorBoundaryInfo): Promise<void> {
    try {
      await fetch('/api/metrics/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorInfo)
      });
    } catch (error) {
      console.error('Failed to send error report:', error);
    }
  }

  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        result[name] = {
          count: sorted.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
        };
      }
    }
    
    return result;
  }

  sendMetrics(): void {
    // Send comprehensive metrics including UX data
    const metricsData = this.getMetrics();
    const uxData = this.trackUserExperience();
    
    const payload = {
      timestamp: new Date().toISOString(),
      metrics: metricsData,
      userExperience: uxData,
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: this.getConnectionInfo()
    };

    if (Object.keys(metricsData).length > 0) {
      fetch('/api/metrics/frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error('Failed to send frontend metrics:', error);
      });
    }
  }

  private getConnectionInfo(): any {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }
    
    return null;
  }

  // Real User Monitoring (RUM) metrics
  trackRealUserMonitoring(): void {
    if ('PerformanceObserver' in window) {
      // Track Largest Contentful Paint (LCP)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.recordMetric('lcp', entry.startTime);
          }
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // Track First Input Delay (FID)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'first-input') {
            const fidEntry = entry as PerformanceEventTiming;
            const fid = fidEntry.processingStart - fidEntry.startTime;
            this.recordMetric('fid', fid);
          }
        }
      }).observe({ type: 'first-input', buffered: true });

      // Track Cumulative Layout Shift (CLS)
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            const layoutEntry = entry as any;
            if (!layoutEntry.hadRecentInput) {
              clsValue += layoutEntry.value;
            }
          }
        }
        this.recordMetric('cls', clsValue);
      }).observe({ type: 'layout-shift', buffered: true });
    }
  }

  // Start periodic metrics collection
  startCollection(): void {
    // Send metrics every 5 minutes
    setInterval(() => {
      this.sendMetrics();
    }, 5 * 60 * 1000);
  }
}

export const frontendMonitor = new FrontendMonitor();

// Performance observer for page load metrics
if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        frontendMonitor.trackPageLoad(
          window.location.pathname, 
          navEntry.loadEventEnd - navEntry.navigationStart
        );
      }
    }
  });
  
  try {
    observer.observe({ entryTypes: ['navigation'] });
  } catch (error) {
    console.warn('Performance Observer not supported:', error);
  }
}

// Auto-start collection when imported
if (typeof window !== 'undefined') {
  frontendMonitor.startCollection();
  frontendMonitor.trackRealUserMonitoring();
}

// Vue 3 Error Boundary Plugin
export const errorBoundaryPlugin = {
  install(app: any) {
    app.config.errorHandler = (error: any, instance: any, info: string) => {
      const componentName = instance?.$options?.name || 'Unknown';
      frontendMonitor.trackError(error, `vue_error_${componentName}`, window.location.pathname);
    };
  }
};

// React-style Error Boundary (for reference)
export class ErrorBoundary {
  constructor(private componentName: string) {}

  handleError(error: Error, errorInfo: any): void {
    frontendMonitor.trackError(error, `component_${this.componentName}`, window.location.pathname);
  }
}

// Performance monitoring hooks for Vue composables
export function usePerformanceMonitor() {
  const trackOperation = async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      frontendMonitor.recordMetric(`operation_${operationName}`, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      frontendMonitor.recordMetric(`operation_${operationName}_error`, duration);
      frontendMonitor.trackError(error as Error, 'operation', window.location.pathname);
      throw error;
    }
  };

  const trackRender = (componentName: string, renderTime: number): void => {
    frontendMonitor.recordMetric(`render_${componentName}`, renderTime);
  };

  const trackNavigation = (from: string, to: string, duration: number): void => {
    frontendMonitor.recordMetric('navigation', duration);
    frontendMonitor.trackUserAction('navigate');
  };

  return {
    trackOperation,
    trackRender,
    trackNavigation
  };
}