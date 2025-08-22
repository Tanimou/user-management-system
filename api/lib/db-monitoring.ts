import { prisma } from './prisma.js';

export interface DatabaseMetrics {
  connectionInfo: Record<string, number>;
  slowQueries: any[];
  databaseSize: string;
  tableStats: any[];
  indexUsage: any[];
}

export class DatabaseMonitor {
  /**
   * Get current database connection information
   */
  static async getConnectionInfo(): Promise<Record<string, number>> {
    try {
      const result = await prisma.$queryRaw<Array<{
        state: string;
        count: bigint;
      }>>`
        SELECT state, COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state;
      `;
      
      return result.reduce((acc, row) => {
        acc[row.state] = Number(row.count);
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      console.error('Failed to get connection info:', error);
      return { error: 1 };
    }
  }
  
  /**
   * Get slow queries for performance analysis
   * Requires pg_stat_statements extension
   */
  static async getSlowQueries(limit: number = 10): Promise<any[]> {
    try {
      return await prisma.$queryRaw`
        SELECT query, calls, total_time, mean_time, rows
        FROM pg_stat_statements 
        WHERE query NOT LIKE '%pg_stat_statements%'
          AND query NOT LIKE '%information_schema%'
        ORDER BY mean_time DESC 
        LIMIT ${limit};
      `;
    } catch (error) {
      // pg_stat_statements may not be enabled
      console.warn('pg_stat_statements not available:', error);
      return [];
    }
  }
  
  /**
   * Get total database size
   */
  static async getDatabaseSize(): Promise<string> {
    try {
      const result = await prisma.$queryRaw<Array<{
        size: string;
      }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `;
      
      return result[0]?.size || 'Unknown';
    } catch (error) {
      console.error('Failed to get database size:', error);
      return 'Error retrieving size';
    }
  }
  
  /**
   * Get table statistics for monitoring growth
   */
  static async getTableStats(): Promise<any[]> {
    try {
      return await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `;
    } catch (error) {
      console.error('Failed to get table stats:', error);
      return [];
    }
  }
  
  /**
   * Get index usage statistics
   */
  static async getIndexUsage(): Promise<any[]> {
    try {
      return await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_tup_read DESC;
      `;
    } catch (error) {
      console.error('Failed to get index usage:', error);
      return [];
    }
  }
  
  /**
   * Check database health and return comprehensive metrics
   */
  static async getHealthMetrics(): Promise<DatabaseMetrics> {
    const [connectionInfo, slowQueries, databaseSize, tableStats, indexUsage] = 
      await Promise.allSettled([
        this.getConnectionInfo(),
        this.getSlowQueries(5),
        this.getDatabaseSize(),
        this.getTableStats(),
        this.getIndexUsage()
      ]);
    
    return {
      connectionInfo: connectionInfo.status === 'fulfilled' ? connectionInfo.value : {},
      slowQueries: slowQueries.status === 'fulfilled' ? slowQueries.value : [],
      databaseSize: databaseSize.status === 'fulfilled' ? databaseSize.value : 'Unknown',
      tableStats: tableStats.status === 'fulfilled' ? tableStats.value : [],
      indexUsage: indexUsage.status === 'fulfilled' ? indexUsage.value : []
    };
  }
  
  /**
   * Test database performance with simple queries
   */
  static async performanceTest(): Promise<{
    simpleQuery: number;
    complexQuery: number;
    insertTest: number;
  }> {
    const results = {
      simpleQuery: 0,
      complexQuery: 0,
      insertTest: 0
    };
    
    try {
      // Test simple query performance
      const start1 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      results.simpleQuery = Date.now() - start1;
      
      // Test complex query performance (user table scan)
      const start2 = Date.now();
      await prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      results.complexQuery = Date.now() - start2;
      
      // Test write performance (audit log entry)
      const start3 = Date.now();
      await prisma.auditLog.create({
        data: {
          action: 'PERFORMANCE_TEST',
          entity: 'Database',
          payload: { timestamp: new Date().toISOString() }
        }
      });
      results.insertTest = Date.now() - start3;
      
    } catch (error) {
      console.error('Performance test failed:', error);
    }
    
    return results;
  }
  
  /**
   * Get connection pool status (estimated based on query activity)
   */
  static async getConnectionPoolStatus(): Promise<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    maxConnections?: number;
  }> {
    try {
      const connections = await this.getConnectionInfo();
      const active = connections['active'] || 0;
      const idle = connections['idle'] || 0;
      const total = Object.values(connections).reduce((sum, count) => sum + count, 0);
      
      // Try to get max connections setting
      let maxConnections;
      try {
        const result = await prisma.$queryRaw<Array<{ setting: string }>>`
          SHOW max_connections;
        `;
        maxConnections = parseInt(result[0]?.setting || '0');
      } catch {
        // Ignore if can't get max connections
      }
      
      return {
        activeConnections: active,
        idleConnections: idle,
        totalConnections: total,
        maxConnections
      };
    } catch (error) {
      console.error('Failed to get connection pool status:', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0
      };
    }
  }
}

export default DatabaseMonitor;