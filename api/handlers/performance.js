import { setCORSHeaders, setSecurityHeaders, requireAuth } from '../lib/auth.js';
import PerformanceMonitor from '../lib/performance-monitor.js';
export default async function handler(req, res) {
    // Set CORS and security headers
    setCORSHeaders(res);
    setSecurityHeaders(res);
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        // Verify authentication - only authenticated users can access performance metrics
        const authReq = req;
        if (!(await requireAuth(authReq, res))) {
            return; // requireAuth already sent the response
        }
        // Only admin users can access performance monitoring
        const { user } = authReq;
        if (!user?.roles?.includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const { report = 'basic', tests = 'false', format = 'json' } = req.query;
        let result = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'unknown'
        };
        // Basic metrics collection
        if (report === 'basic' || report === 'full') {
            const metrics = await PerformanceMonitor.collectMetrics();
            const { alerts, hasAlerts } = PerformanceMonitor.checkAlertConditions(metrics);
            result.basic = {
                status: metrics.status,
                responseTime: metrics.responseTime,
                connectionPool: {
                    usage: metrics.connectionPoolUsage,
                    active: metrics.activeConnections,
                    total: metrics.totalConnections
                },
                databaseSize: metrics.databaseSize,
                slowQueries: metrics.slowQueries,
                errors: metrics.errors
            };
            if (hasAlerts) {
                result.alerts = alerts;
            }
        }
        // Full performance report
        if (report === 'full') {
            const performanceReport = await PerformanceMonitor.generatePerformanceReport();
            result.full = {
                healthScore: performanceReport.healthScore,
                alerts: performanceReport.alerts,
                recommendations: performanceReport.recommendations
            };
        }
        // Performance tests
        if (tests === 'true') {
            const testResults = await PerformanceMonitor.runPerformanceTests();
            result.performanceTests = testResults;
        }
        // Format response
        if (format === 'prometheus') {
            return res.status(200).setHeader('Content-Type', 'text/plain').send(formatPrometheusMetrics(result));
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error('Performance monitoring error:', error);
        return res.status(500).json({
            error: 'Failed to retrieve performance metrics',
            timestamp: new Date().toISOString()
        });
    }
}
/**
 * Format metrics for Prometheus monitoring system
 */
function formatPrometheusMetrics(data) {
    const metrics = [];
    const timestamp = Date.now();
    if (data.basic) {
        metrics.push(`# HELP database_response_time_ms Database response time in milliseconds`);
        metrics.push(`# TYPE database_response_time_ms gauge`);
        metrics.push(`database_response_time_ms ${data.basic.responseTime} ${timestamp}`);
        metrics.push(`# HELP database_connection_pool_usage_percent Connection pool usage percentage`);
        metrics.push(`# TYPE database_connection_pool_usage_percent gauge`);
        metrics.push(`database_connection_pool_usage_percent ${data.basic.connectionPool.usage} ${timestamp}`);
        metrics.push(`# HELP database_active_connections Active database connections`);
        metrics.push(`# TYPE database_active_connections gauge`);
        metrics.push(`database_active_connections ${data.basic.connectionPool.active} ${timestamp}`);
        metrics.push(`# HELP database_total_connections Total database connections`);
        metrics.push(`# TYPE database_total_connections gauge`);
        metrics.push(`database_total_connections ${data.basic.connectionPool.total} ${timestamp}`);
        metrics.push(`# HELP database_slow_queries_count Number of slow queries`);
        metrics.push(`# TYPE database_slow_queries_count gauge`);
        metrics.push(`database_slow_queries_count ${data.basic.slowQueries} ${timestamp}`);
        metrics.push(`# HELP database_errors_count Number of database errors`);
        metrics.push(`# TYPE database_errors_count gauge`);
        metrics.push(`database_errors_count ${data.basic.errors?.length || 0} ${timestamp}`);
        // Status as numeric (0 = healthy, 1 = warning, 2 = critical)
        const statusValue = data.basic.status === 'healthy' ? 0 : data.basic.status === 'warning' ? 1 : 2;
        metrics.push(`# HELP database_status Database status (0=healthy, 1=warning, 2=critical)`);
        metrics.push(`# TYPE database_status gauge`);
        metrics.push(`database_status ${statusValue} ${timestamp}`);
    }
    if (data.full) {
        metrics.push(`# HELP database_health_score Database health score (0-100)`);
        metrics.push(`# TYPE database_health_score gauge`);
        metrics.push(`database_health_score ${data.full.healthScore} ${timestamp}`);
        metrics.push(`# HELP database_alerts_count Number of active alerts`);
        metrics.push(`# TYPE database_alerts_count gauge`);
        metrics.push(`database_alerts_count ${data.full.alerts?.length || 0} ${timestamp}`);
    }
    if (data.performanceTests) {
        metrics.push(`# HELP database_simple_query_time_ms Simple query execution time in milliseconds`);
        metrics.push(`# TYPE database_simple_query_time_ms gauge`);
        metrics.push(`database_simple_query_time_ms ${data.performanceTests.testResults.simpleQuery} ${timestamp}`);
        metrics.push(`# HELP database_complex_query_time_ms Complex query execution time in milliseconds`);
        metrics.push(`# TYPE database_complex_query_time_ms gauge`);
        metrics.push(`database_complex_query_time_ms ${data.performanceTests.testResults.complexQuery} ${timestamp}`);
        metrics.push(`# HELP database_insert_time_ms Insert operation time in milliseconds`);
        metrics.push(`# TYPE database_insert_time_ms gauge`);
        metrics.push(`database_insert_time_ms ${data.performanceTests.testResults.insertTest} ${timestamp}`);
    }
    return metrics.join('\n') + '\n';
}
