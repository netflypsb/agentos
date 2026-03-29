// Performance optimization and monitoring utilities

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static readonly MAX_METRICS = 1000;

  static startTimer(operation: string): () => PerformanceMetrics {
    const startTime = performance.now();
    
    return (): PerformanceMetrics => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const metric: PerformanceMetrics = {
        operation,
        startTime,
        endTime,
        duration,
        success: true
      };

      this.addMetric(metric);
      return metric;
    };
  }

  static recordError(operation: string, error: Error): void {
    const metric: PerformanceMetrics = {
      operation,
      startTime: 0,
      endTime: performance.now(),
      duration: 0,
      success: false,
      error: error.message
    };

    this.addMetric(metric);
  }

  private static addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  static getMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return [...this.metrics];
  }

  static getAverageTime(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    const successfulMetrics = operationMetrics.filter(m => m.success);
    
    if (successfulMetrics.length === 0) return 0;
    
    const total = successfulMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / successfulMetrics.length;
  }

  static getPercentile(operation: string, percentile: number): number {
    const operationMetrics = this.getMetrics(operation)
      .filter(m => m.success)
      .map(m => m.duration)
      .sort((a, b) => a - b);

    if (operationMetrics.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * operationMetrics.length) - 1;
    return operationMetrics[Math.max(0, index)];
  }

  static getSummary(): string {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    let summary = "Performance Summary:\n\n";

    operations.forEach(op => {
      const metrics = this.getMetrics(op);
      const successful = metrics.filter(m => m.success);
      const failed = metrics.filter(m => !m.success);
      
      if (successful.length > 0) {
        const avg = this.getAverageTime(op);
        const p50 = this.getPercentile(op, 50);
        const p95 = this.getPercentile(op, 95);
        const p99 = this.getPercentile(op, 99);

        summary += `${op}:\n`;
        summary += `  Operations: ${successful.length} successful, ${failed.length} failed\n`;
        summary += `  Average: ${avg.toFixed(2)}ms\n`;
        summary += `  50th percentile: ${p50.toFixed(2)}ms\n`;
        summary += `  95th percentile: ${p95.toFixed(2)}ms\n`;
        summary += `  99th percentile: ${p99.toFixed(2)}ms\n\n`;
      }
    });

    return summary;
  }

  static reset(): void {
    this.metrics = [];
  }
}

// Database query optimization
export class QueryOptimizer {
  private static queryCache = new Map<string, { result: any; timestamp: number }>();
  private static readonly CACHE_TTL = 300000; // 5 minutes

  static cachedQuery<T>(
    key: string, 
    query: () => T, 
    ttl: number = this.CACHE_TTL
  ): T {
    const cached = this.queryCache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < ttl) {
      return cached.result;
    }

    const result = query();
    this.queryCache.set(key, { result, timestamp: now });

    // Clean up old cache entries
    this.cleanupCache();
    
    return result;
  }

  public static cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.queryCache.entries()) {
      if ((now - value.timestamp) > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  static invalidateCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of this.queryCache.keys()) {
        if (regex.test(key)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }

  static getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.queryCache.size,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }
}

// Connection pooling simulation (for future use with external databases)
export class ConnectionPool {
  private static connections: any[] = [];
  private static readonly MAX_SIZE = 10;

  static async getConnection(): Promise<any> {
    // For SQLite, we don't need connection pooling
    // This is a placeholder for future database systems
    return null;
  }

  static releaseConnection(connection: any): void {
    // Placeholder for future implementation
  }

  static closeAll(): void {
    // Placeholder for future implementation
  }
}

// Response caching for frequently accessed data
export class ResponseCache {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static set(key: string, data: any, ttl: number = 60000): void { // Default 1 minute
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;

    const now = Date.now();
    if ((now - cached.timestamp) > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  static invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  static cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if ((now - value.timestamp) > value.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  static getStats(): { size: number; entries: Array<{ key: string; age: number; ttl: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp,
      ttl: value.ttl
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Performance monitoring decorator
export function monitorPerformance(operationName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const endTimer = PerformanceMonitor.startTimer(operation);
      
      try {
        const result = await method.apply(this, args);
        endTimer();
        return result;
      } catch (error) {
        PerformanceMonitor.recordError(operation, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

// Automatic cleanup interval
setInterval(() => {
  QueryOptimizer.cleanupCache();
  ResponseCache.cleanup();
}, 60000); // Clean up every minute
