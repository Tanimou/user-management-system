# Database Troubleshooting and Maintenance Guide

This guide provides comprehensive procedures for troubleshooting database issues and performing routine maintenance for the User Management System.

## 🔧 Common Issues and Solutions

### 1. Connection Issues

#### Problem: Database Connection Timeouts
**Symptoms:**
- API endpoints returning 500 errors
- "Connection timeout" in logs
- High response times

**Diagnosis:**
```bash
# Check connection pool status
curl "https://your-domain.com/api/db-monitor?metrics=basic"

# Monitor active connections
psql $DATABASE_URL -c "
SELECT state, count(*) 
FROM pg_stat_activity 
WHERE datname = current_database() 
GROUP BY state;
"
```

**Solutions:**
1. **Immediate Fix:**
   ```bash
   # Restart application (Vercel will auto-restart functions)
   vercel rollout --prod
   
   # Or force connection pool reset
   vercel env add FORCE_RESTART
   vercel env rm FORCE_RESTART
   ```

2. **Long-term Fix:**
   ```typescript
   // Increase connection timeout in Prisma
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + '?connection_timeout=30&pool_timeout=30'
       }
     }
   });
   ```

#### Problem: "Too many connections" Error
**Symptoms:**
- PostgreSQL error: "FATAL: too many connections"
- New connections fail
- Application becomes unresponsive

**Diagnosis:**
```sql
-- Check current connection count vs limit
SELECT 
    (SELECT count(*) FROM pg_stat_activity) as current_connections,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections;

-- Identify connection sources
SELECT client_addr, state, count(*) 
FROM pg_stat_activity 
WHERE datname = current_database() 
GROUP BY client_addr, state 
ORDER BY count(*) DESC;
```

**Solutions:**
1. **Emergency Fix:**
   ```sql
   -- Kill idle connections
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = current_database() 
     AND state = 'idle' 
     AND state_change < now() - interval '5 minutes';
   ```

2. **Preventive Measures:**
   ```bash
   # Configure connection pooling
   DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=10"
   
   # Or use connection pool service
   DATABASE_URL="postgresql://user:pass@pooler.provider.com:5432/db"
   ```

### 2. Performance Issues

#### Problem: Slow Query Performance
**Symptoms:**
- API response times > 2 seconds
- Database CPU usage high
- Users reporting slow loading

**Diagnosis:**
```bash
# Run performance analysis
./scripts/migrate-production.sh monitor

# Check slow queries
curl "https://your-domain.com/api/performance?tests=true&report=full"
```

**Detailed Query Analysis:**
```sql
-- Find slowest queries (requires pg_stat_statements)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
  AND n_distinct < 100
ORDER BY correlation DESC;
```

**Solutions:**
1. **Add Missing Indexes:**
   ```sql
   -- Create composite indexes for common queries
   CREATE INDEX CONCURRENTLY idx_users_active_created 
   ON users(isActive, createdAt) 
   WHERE isActive = true;
   
   CREATE INDEX CONCURRENTLY idx_audit_logs_entity_date 
   ON audit_logs(entity, created_at);
   ```

2. **Optimize Queries:**
   ```typescript
   // Before: Inefficient query
   const users = await prisma.user.findMany({
     where: { isActive: true },
     include: { auditLogs: true }
   });
   
   // After: Optimized query
   const users = await prisma.user.findMany({
     where: { isActive: true },
     select: {
       id: true,
       name: true,
       email: true,
       roles: true,
       createdAt: true
     }
   });
   ```

#### Problem: High Memory Usage
**Diagnosis:**
```sql
-- Check database size and table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for bloated tables
SELECT 
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    ROUND((n_dead_tup::float / (n_live_tup + n_dead_tup)) * 100, 2) as dead_tuple_percent
FROM pg_stat_user_tables 
WHERE n_live_tup > 0
ORDER BY dead_tuple_percent DESC;
```

**Solutions:**
```sql
-- Manual vacuum for immediate relief
VACUUM ANALYZE users;
VACUUM ANALYZE audit_logs;

-- Set up automatic maintenance
ALTER TABLE users SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE audit_logs SET (autovacuum_vacuum_scale_factor = 0.1);
```

### 3. Data Integrity Issues

#### Problem: Duplicate Email Addresses
**Diagnosis:**
```sql
-- Find duplicate emails
SELECT email, COUNT(*) as count
FROM users 
GROUP BY email 
HAVING COUNT(*) > 1;
```

**Solution:**
```sql
-- Clean up duplicates (keep the oldest record)
WITH duplicates AS (
  SELECT id, email, 
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) as rn
  FROM users
)
DELETE FROM users 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
```

#### Problem: Orphaned Audit Log Records
**Diagnosis:**
```sql
-- Find audit logs without corresponding users
SELECT COUNT(*) as orphaned_count
FROM audit_logs al
LEFT JOIN users u ON al.actor_id = u.id
WHERE al.actor_id IS NOT NULL AND u.id IS NULL;
```

**Solution:**
```sql
-- Clean up orphaned records
DELETE FROM audit_logs 
WHERE actor_id IS NOT NULL 
  AND actor_id NOT IN (SELECT id FROM users);
```

### 4. Migration Issues

#### Problem: Migration Fails
**Symptoms:**
- `prisma migrate deploy` returns error
- Database schema inconsistent
- Application crashes on startup

**Diagnosis:**
```bash
# Check migration status
npx prisma migrate status

# Check database schema
npx prisma db pull
git diff prisma/schema.prisma
```

**Solutions:**
1. **Reset Migration State:**
   ```bash
   # Mark migration as applied (if manually fixed)
   npx prisma migrate resolve --applied 20240101000000_migration_name
   
   # Mark migration as rolled back
   npx prisma migrate resolve --rolled-back 20240101000000_migration_name
   ```

2. **Manual Schema Fix:**
   ```sql
   -- Fix schema manually then update migration table
   ALTER TABLE users ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);
   
   -- Update migration history
   INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
   VALUES ('migration_id', 'checksum', NOW(), 'manual_fix', NULL, NULL, NOW(), 1);
   ```

## 🔍 Diagnostic Tools and Scripts

### 1. Health Check Script
```bash
#!/bin/bash
# database-health-check.sh

echo "🏥 Database Health Check"
echo "======================"

# Test connectivity
echo "Testing connectivity..."
if psql $DATABASE_URL -c "SELECT 1" >/dev/null 2>&1; then
    echo "✅ Database connection: OK"
else
    echo "❌ Database connection: FAILED"
    exit 1
fi

# Check disk usage
echo "Checking database size..."
DB_SIZE=$(psql $DATABASE_URL -t -c "SELECT pg_size_pretty(pg_database_size(current_database()))")
echo "📊 Database size: $DB_SIZE"

# Check connection count
CONNECTIONS=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")
echo "🔗 Active connections: $CONNECTIONS"

# Check for long-running queries
LONG_QUERIES=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes'")
if [ "$LONG_QUERIES" -gt 0 ]; then
    echo "⚠️  Long-running queries detected: $LONG_QUERIES"
else
    echo "✅ No long-running queries"
fi

# Check for table bloat
echo "Checking table maintenance..."
psql $DATABASE_URL -c "
SELECT 
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    CASE WHEN n_live_tup > 0 
         THEN ROUND((n_dead_tup::float / (n_live_tup + n_dead_tup)) * 100, 2) 
         ELSE 0 
    END as dead_tuple_percent
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY dead_tuple_percent DESC;
"

echo "✅ Health check completed"
```

### 2. Performance Analysis Script
```bash
#!/bin/bash
# performance-analysis.sh

echo "⚡ Database Performance Analysis"
echo "=============================="

# Query performance
echo "Top 10 slowest queries:"
psql $DATABASE_URL -c "
SELECT 
    SUBSTRING(query, 1, 60) as query_start,
    calls,
    ROUND(total_time::numeric, 2) as total_time_ms,
    ROUND(mean_time::numeric, 2) as mean_time_ms,
    ROUND(stddev_time::numeric, 2) as stddev_time_ms
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%COMMIT%'
  AND query NOT LIKE '%BEGIN%'
ORDER BY mean_time DESC 
LIMIT 10;
" 2>/dev/null || echo "pg_stat_statements not available"

# Index usage
echo -e "\nIndex usage analysis:"
psql $DATABASE_URL -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    CASE WHEN idx_tup_read > 0 
         THEN ROUND((idx_tup_fetch::float / idx_tup_read) * 100, 2) 
         ELSE 0 
    END as hit_rate_percent
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;
"

# Cache hit ratio
echo -e "\nCache hit ratio:"
psql $DATABASE_URL -c "
SELECT 
    'Table Cache Hit Rate' as metric,
    ROUND((sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 2) as percentage
FROM pg_statio_user_tables
WHERE heap_blks_read > 0

UNION ALL

SELECT 
    'Index Cache Hit Rate' as metric,
    ROUND((sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read))) * 100, 2) as percentage
FROM pg_statio_user_indexes
WHERE idx_blks_read > 0;
"
```

### 3. Maintenance Script
```bash
#!/bin/bash
# database-maintenance.sh

echo "🔧 Database Maintenance"
echo "======================"

# Vacuum and analyze tables
echo "Running VACUUM ANALYZE..."
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Update table statistics
echo "Updating statistics..."
psql $DATABASE_URL -c "ANALYZE;"

# Reindex tables if needed
echo "Checking for index bloat..."
psql $DATABASE_URL -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
  AND pg_relation_size(indexname::regclass) > 1024*1024  -- > 1MB
ORDER BY pg_relation_size(indexname::regclass) DESC;
"

# Clean up old audit logs (optional)
if [ "$CLEANUP_OLD_LOGS" = "true" ]; then
    echo "Cleaning up old audit logs..."
    DELETED=$(psql $DATABASE_URL -t -c "
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '90 days'
        RETURNING 1;
    " | wc -l)
    echo "Deleted $DELETED old audit log entries"
fi

echo "✅ Maintenance completed"
```

## 📅 Maintenance Schedule

### Daily Tasks
```bash
# Add to cron: 0 2 * * *
#!/bin/bash
# daily-maintenance.sh

./database-health-check.sh
./performance-analysis.sh > /tmp/perf_$(date +%Y%m%d).log
```

### Weekly Tasks
```bash
# Add to cron: 0 3 * * 0
#!/bin/bash
# weekly-maintenance.sh

./database-maintenance.sh
./backup-verify.sh
./security-audit.sh
```

### Monthly Tasks
```bash
# Add to cron: 0 4 1 * *
#!/bin/bash
# monthly-maintenance.sh

./full-health-check.sh
./capacity-planning.sh
./security-review.sh
./performance-tune.sh
```

## 🚨 Emergency Procedures

### 1. Database Outage Response
```bash
#!/bin/bash
# emergency-response.sh

echo "🚨 DATABASE EMERGENCY RESPONSE"
echo "============================="

# Step 1: Assess the situation
echo "1. Assessing database status..."
if ! psql $DATABASE_URL -c "SELECT 1" >/dev/null 2>&1; then
    echo "❌ Database is unreachable"
    
    # Check if it's a network issue
    ping -c 3 $(echo $DATABASE_URL | cut -d@ -f2 | cut -d: -f1)
    
    # Check Vercel status if using Vercel Postgres
    curl -s https://www.vercel-status.com/api/v2/status.json | jq '.status.indicator'
    
else
    echo "✅ Database is reachable"
fi

# Step 2: Check application health
echo "2. Checking application health..."
curl -f https://your-domain.com/api/health || echo "❌ Application health check failed"

# Step 3: Gather diagnostics
echo "3. Gathering diagnostics..."
./database-health-check.sh > emergency_$(date +%Y%m%d_%H%M%S).log 2>&1

# Step 4: Notify stakeholders
echo "4. Notification required - check logs and alert team"
```

### 2. Performance Emergency
```bash
#!/bin/bash
# performance-emergency.sh

echo "⚡ PERFORMANCE EMERGENCY RESPONSE"
echo "================================"

# Kill long-running queries
echo "Terminating long-running queries..."
psql $DATABASE_URL -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query_start < now() - interval '10 minutes'
  AND query NOT LIKE '%pg_stat_activity%';
"

# Emergency vacuum
echo "Running emergency maintenance..."
psql $DATABASE_URL -c "VACUUM (VERBOSE, ANALYZE);"

# Check connection pool
echo "Checking connection pool..."
./database-health-check.sh
```

## 📊 Monitoring and Alerting Setup

### 1. Automated Monitoring
```typescript
// monitoring-service.ts
import PerformanceMonitor from './lib/performance-monitor.js';

// Set up monitoring alerts
const monitoringConfig = {
  healthCheck: {
    interval: 5 * 60 * 1000, // 5 minutes
    thresholds: {
      responseTime: 1000,
      connectionPool: 80,
      errorRate: 1
    }
  },
  alerts: {
    slack: process.env.SLACK_WEBHOOK_URL,
    email: process.env.ALERT_EMAIL,
    pagerduty: process.env.PAGERDUTY_KEY
  }
};

// Start monitoring
PerformanceMonitor.startMonitoring(monitoringConfig.healthCheck.interval);
```

### 2. Dashboard Setup
```bash
# Grafana dashboard query examples
# Connection count
SELECT time, count FROM database_connections WHERE time > now() - 1h

# Response times
SELECT time, response_time FROM database_metrics WHERE time > now() - 1h

# Error rates
SELECT time, error_count FROM database_errors WHERE time > now() - 1h
```

## 🔗 Related Documentation

- [Database Security Configuration](DATABASE_SECURITY.md)
- [Backup and Recovery Procedures](BACKUP_RECOVERY.md)
- [Database Schema & Migration Guide](DATABASE_SCHEMA.md)
- [Operations Runbook](../docs/OPERATIONS.md)

---

**📞 Emergency Contact**: For critical database issues, escalate to the database administrator or DevOps team immediately. Keep this guide accessible during incidents.