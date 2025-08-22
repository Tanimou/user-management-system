# Database Backup and Recovery Procedures

This document outlines comprehensive backup and recovery procedures for the User Management System's production database.

## 🏗️ Architecture Overview

The system uses PostgreSQL as the primary database with the following characteristics:
- **ORM**: Prisma with connection pooling
- **Deployment**: Vercel serverless functions
- **Migration Management**: Prisma Migrate
- **Providers**: Vercel Postgres, Neon, AWS RDS, or other PostgreSQL providers

## 📋 Backup Strategies

### 1. Automated Daily Backups

#### Vercel Postgres
Vercel Postgres automatically creates:
- **Point-in-time recovery**: Up to 7 days (Hobby) or 30 days (Pro/Enterprise)
- **Daily snapshots**: Retained based on plan
- **Access**: Via Vercel Dashboard → Database → Backups

```bash
# Verify backup status (manual verification)
vercel postgres show
```

#### Neon Database
Neon provides:
- **Continuous backup**: Point-in-time recovery
- **Branch-based backups**: Create database branches for testing
- **Retention**: Based on plan (7-30 days)

```bash
# Create a database branch for backup/testing
neon branches create --database-url $DATABASE_URL backup-$(date +%Y%m%d)
```

#### AWS RDS
Configure automated backups:
- **Backup window**: Off-peak hours
- **Retention**: 7-35 days
- **Cross-region replication**: For disaster recovery

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier your-instance \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d-%H%M)
```

### 2. Manual Backup Procedures

#### For Critical Operations
Before major deployments or schema changes:

```bash
# Using pg_dump (requires direct database access)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Schema-only backup
pg_dump --schema-only $DATABASE_URL > schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Data-only backup
pg_dump --data-only $DATABASE_URL > data_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Provider-Specific Backup Commands

**Vercel Postgres**:
```bash
# Export via Vercel CLI
vercel postgres dump --schema=public > backup_$(date +%Y%m%d).sql
```

**Neon**:
```bash
# Use standard PostgreSQL tools with Neon connection string
pg_dump $NEON_DATABASE_URL > neon_backup_$(date +%Y%m%d).sql
```

### 3. Backup Verification

Always verify backup integrity:

```bash
#!/bin/bash
# backup-verify.sh

BACKUP_FILE="$1"

if [[ -z "$BACKUP_FILE" ]]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

# Check file size (should not be 0)
if [[ ! -s "$BACKUP_FILE" ]]; then
    echo "❌ Backup file is empty or doesn't exist"
    exit 1
fi

# Check for SQL syntax errors
if head -n 20 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
    echo "✅ Backup file appears to be valid PostgreSQL dump"
else
    echo "⚠️  Backup file format may be invalid"
fi

# Additional checks for compressed files
if [[ "$BACKUP_FILE" == *.gz ]]; then
    if gzip -t "$BACKUP_FILE"; then
        echo "✅ Compressed backup file is valid"
    else
        echo "❌ Compressed backup file is corrupted"
        exit 1
    fi
fi
```

## 🔄 Recovery Procedures

### 1. Point-in-Time Recovery

#### Vercel Postgres
1. **Via Dashboard**:
   - Go to Vercel Dashboard → Project → Storage
   - Select your Postgres database
   - Navigate to Backups tab
   - Choose recovery point
   - Create new database instance

2. **Via API** (if available):
```bash
# This depends on Vercel's API - check current documentation
vercel postgres restore --to-time "2024-01-01T12:00:00Z"
```

#### Neon Database
```bash
# Create branch from specific timestamp
neon branches create \
  --database-url $DATABASE_URL \
  --parent-timestamp "2024-01-01T12:00:00Z" \
  recovery-branch
```

### 2. Full Database Restore

#### From SQL Backup File
```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE="$1"
TARGET_DATABASE_URL="$2"

if [[ -z "$BACKUP_FILE" || -z "$TARGET_DATABASE_URL" ]]; then
    echo "Usage: $0 <backup-file> <target-database-url>"
    exit 1
fi

echo "🔄 Starting database restoration..."
echo "Backup file: $BACKUP_FILE"
echo "Target database: $TARGET_DATABASE_URL"

# Verify backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "❌ Backup file not found"
    exit 1
fi

# Create restoration log
LOG_FILE="restore_$(date +%Y%m%d_%H%M%S).log"

# Drop existing connections (if possible)
echo "⚠️  Terminating existing connections..."
psql $TARGET_DATABASE_URL -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = current_database() 
  AND pid <> pg_backend_pid();
" 2>/dev/null || echo "Warning: Could not terminate connections"

# Restore database
echo "📥 Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql $TARGET_DATABASE_URL > "$LOG_FILE" 2>&1
else
    psql $TARGET_DATABASE_URL < "$BACKUP_FILE" > "$LOG_FILE" 2>&1
fi

if [[ $? -eq 0 ]]; then
    echo "✅ Database restoration completed successfully"
    echo "📄 Log file: $LOG_FILE"
else
    echo "❌ Database restoration failed"
    echo "📄 Check log file: $LOG_FILE"
    exit 1
fi

# Verify restoration
echo "🔍 Verifying restoration..."
psql $TARGET_DATABASE_URL -c "
SELECT 
    schemaname, 
    tablename, 
    n_tup_ins, 
    n_tup_upd, 
    n_tup_del 
FROM pg_stat_user_tables;
" >> "$LOG_FILE"

echo "✅ Restoration verification completed"
```

### 3. Disaster Recovery Procedures

#### Complete System Recovery

1. **Assessment Phase**:
```bash
# Check what's available
./scripts/migrate-production.sh pre-check
```

2. **Recovery Environment Setup**:
```bash
# Set up temporary database if needed
export RECOVERY_DATABASE_URL="your-recovery-database-url"
export NODE_ENV="recovery"
```

3. **Data Recovery**:
```bash
# Restore from latest backup
./restore-database.sh latest_backup.sql $RECOVERY_DATABASE_URL

# Apply any missing migrations
npx prisma migrate deploy
```

4. **Validation**:
```bash
# Run health checks
./scripts/migrate-production.sh health-check

# Test application functionality
curl https://your-recovery-domain.com/api/health
```

5. **Cutover**:
```bash
# Update DNS/environment variables to point to recovery database
vercel env add DATABASE_URL
# Enter recovery database URL
```

## 📊 Monitoring and Alerting

### 1. Backup Monitoring

Create monitoring scripts to verify backup completion:

```bash
#!/bin/bash
# monitor-backups.sh

# Check last backup age (example for automated systems)
LAST_BACKUP=$(date -d "$(vercel postgres show | grep 'Last backup' | awk '{print $3}')" +%s)
CURRENT_TIME=$(date +%s)
AGE_HOURS=$(( ($CURRENT_TIME - $LAST_BACKUP) / 3600 ))

if [[ $AGE_HOURS -gt 25 ]]; then
    echo "⚠️  Backup is older than 25 hours"
    # Send alert (Slack, email, etc.)
    exit 1
else
    echo "✅ Backup is recent ($AGE_HOURS hours old)"
fi
```

### 2. Recovery Testing

Monthly recovery testing procedure:

```bash
#!/bin/bash
# monthly-recovery-test.sh

echo "🧪 Monthly Recovery Test - $(date)"

# 1. Create test database
TEST_DB_URL="postgresql://test_recovery_$(date +%Y%m%d)@localhost:5432/recovery_test"

# 2. Restore latest backup
./restore-database.sh latest_backup.sql $TEST_DB_URL

# 3. Verify data integrity
psql $TEST_DB_URL -c "
SELECT 
    'users' as table_name, 
    COUNT(*) as record_count 
FROM users
UNION ALL
SELECT 
    'audit_logs' as table_name, 
    COUNT(*) as record_count 
FROM audit_logs;
"

# 4. Test application connectivity
export DATABASE_URL=$TEST_DB_URL
npm test

# 5. Cleanup
dropdb recovery_test
```

## 🔒 Security Considerations

### 1. Backup Security

- **Encryption**: Ensure backups are encrypted at rest and in transit
- **Access Control**: Limit who can create and restore backups
- **Retention**: Implement secure deletion of old backups
- **Location**: Store backups in different geographic regions

### 2. Recovery Security

- **Audit Trail**: Log all recovery operations
- **Verification**: Verify backup integrity before restoration
- **Network Security**: Use secure connections for all restore operations
- **Data Sanitization**: Remove sensitive data from development/test restores

## 📅 Backup Schedule

### Recommended Backup Schedule

| Frequency | Type | Retention | Purpose |
|-----------|------|-----------|---------|
| Hourly | Point-in-time | 7 days | Quick recovery |
| Daily | Full snapshot | 30 days | Regular restore points |
| Weekly | Full export | 90 days | Long-term archival |
| Monthly | Complete system | 1 year | Compliance/audit |

### Automation Scripts

```bash
# Add to crontab for automated backups
# 0 2 * * * /path/to/daily-backup.sh
# 0 3 * * 0 /path/to/weekly-backup.sh
# 0 4 1 * * /path/to/monthly-backup.sh
```

## 📞 Emergency Contacts

### Escalation Procedures

1. **Database Administrator**: Primary contact for database issues
2. **DevOps Team**: Infrastructure and deployment issues
3. **Application Team**: Business logic and data integrity
4. **Vendor Support**: Database provider specific issues

### Emergency Checklist

- [ ] Assess scope of data loss
- [ ] Identify last known good backup
- [ ] Estimate recovery time objective (RTO)
- [ ] Communicate with stakeholders
- [ ] Document incident for post-mortem

---

## 🔗 Related Documentation

- [Database Schema & Migration Guide](DATABASE_SCHEMA.md)
- [Operations Runbook](../docs/OPERATIONS.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Infrastructure Summary](../docs/INFRASTRUCTURE_SUMMARY.md)

For questions or emergency situations, refer to the project's GitHub repository or contact the development team immediately.