class FrontendMonitor {
  private metrics: Map<string, number[]> = new Map();

  trackPageLoad(page: string, loadTime: number): void {
    this.recordMetric(`page_load_${page}`, loadTime);
    
    if (loadTime > 3000) {
      console.warn(`Slow page load detected: ${page} took ${loadTime}ms`);
    }
  }

  trackApiCall(endpoint: string, duration: number, status: number): void {
    this.recordMetric(`api_${endpoint.replace(/\//g, '_')}`, duration);
    
    if (status >= 400) {
      this.recordMetric(`api_errors_${status}`, 1);
    }
  }

  trackUserAction(action: string, duration?: number): void {
    this.recordMetric(`user_action_${action}`, duration || 1);
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
    // In a real implementation, send metrics to your monitoring service
    const metricsData = this.getMetrics();
    console.log('Frontend Metrics:', metricsData);
    
    // Optional: Send to backend metrics endpoint
    if (Object.keys(metricsData).length > 0) {
      fetch('/api/metrics/frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          metrics: metricsData,
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(error => {
        console.error('Failed to send frontend metrics:', error);
      });
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
}