import { logger } from './logger.js';

export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }

    // Log performance metrics
    logger.performance(name, value);
  }

  static getMetrics(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: Math.round(sum / count),
      p95: sorted[Math.floor(count * 0.95)] || sorted[count - 1]
    };
  }

  static getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    
    return result;
  }

  static withTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const start = Date.now();
      
      try {
        const result = await fn();
        const duration = Date.now() - start;
        this.recordMetric(name, duration);
        resolve(result);
      } catch (error) {
        const duration = Date.now() - start;
        this.recordMetric(`${name}_error`, duration);
        reject(error);
      }
    });
  }

  // Clear metrics (useful for testing)
  static reset(): void {
    this.metrics.clear();
  }

  // Get performance summary
  static getSummary(): {
    totalMetrics: number;
    slowOperations: Array<{ name: string; avgTime: number }>;
    fastOperations: Array<{ name: string; avgTime: number }>;
  } {
    const allMetrics = this.getAllMetrics();
    const operations = Object.entries(allMetrics)
      .filter(([_, metrics]) => metrics && typeof metrics.avg === 'number')
      .map(([name, metrics]) => ({ name, avgTime: metrics.avg }))
      .sort((a, b) => b.avgTime - a.avgTime);

    return {
      totalMetrics: this.metrics.size,
      slowOperations: operations.slice(0, 5), // Top 5 slowest
      fastOperations: operations.slice(-5).reverse() // Top 5 fastest
    };
  }
}

// Database query monitoring
export function withDatabaseMonitoring<T>(operation: string, query: Promise<T>): Promise<T> {
  return PerformanceMonitor.withTiming(`db_${operation}`, () => query);
}