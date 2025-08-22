# Operations Runbook

This runbook provides procedures for operating and maintaining the User Management System in production.

## System Overview

- **Frontend**: Vue 3 SPA served via Vercel CDN
- **Backend**: Node.js serverless functions on Vercel
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh token rotation
- **Monitoring**: Built-in health checks and logging

## Monitoring and Alerting

### Health Check Endpoints

**Primary Health Check**:
```bash
curl https://your-domain.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600.5,
  "services": {
    "database": "connected",
    "memory": {
      "used": 45.2,
      "total": 128.0
    }
  }
}
```

### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|---------|
| Response Time | > 2000ms | Investigate performance |
| Error Rate | > 1% | Check logs and rollback if needed |
| Database Connections | > 80% of pool | Scale database or optimize queries |
| Memory Usage | > 90% | Investigate memory leaks |
| Failed Logins | > 10/minute | Check for brute force attacks |

### Monitoring Setup

**Vercel Analytics** (Built-in):
- Function execution times
- Error rates and status codes
- Geographic performance data

**External Monitoring** (Recommended):
- Uptime Robot / Pingdom for uptime monitoring
- Sentry for error tracking
- DataDog / New Relic for APM (optional)

## Incident Response Procedures

### 1. Service Degradation (Response Time > 2s)

**Immediate Actions**:
1. Check Vercel status page: https://www.vercel-status.com/
2. Review recent deployments in Vercel dashboard
3. Check database performance metrics

**Investigation**:
```bash
# Check recent logs
vercel logs --since=1h

# Monitor real-time logs
vercel logs --follow

# Check function metrics
vercel inspect [function-url]
```

**Resolution**:
- If deployment issue: `vercel rollback`
- If database issue: Contact database provider
- If code issue: Deploy hotfix or rollback

### 2. Service Outage (5xx Errors)

**Immediate Actions**:
1. Verify scope: Frontend, API, or both
2. Check health endpoint response
3. Review Vercel function logs

**Investigation**:
```bash
# Check deployment status
vercel ls

# Check environment variables
vercel env ls

# Test database connectivity
npm run db:studio --workspace=api
```

**Resolution Priority**:
1. **P0 (Critical)**: Complete service outage
2. **P1 (High)**: Authentication failures
3. **P2 (Medium)**: Partial functionality loss
4. **P3 (Low)**: UI/UX issues

### 3. Security Incidents

**Suspected Breach**:
1. **DO NOT PANIC** - Document everything
2. Check authentication logs for anomalies
3. Review recent user creation/modification patterns
4. Monitor for privilege escalation attempts

**Investigation Commands**:
```bash
# Check recent user activities (if database access available)
# This would be done via database admin tools
SELECT id, email, roles, "updatedAt" 
FROM "User" 
WHERE "updatedAt" > NOW() - INTERVAL '1 hour'
ORDER BY "updatedAt" DESC;

# Check for suspicious login patterns
# Monitor failed login attempts in application logs
```

**Immediate Actions**:
1. Rotate JWT secrets if compromised
2. Force logout all users (clear refresh tokens)
3. Review and update security policies
4. Contact security team if available

### 4. Database Issues

**Connection Pool Exhaustion**:
```bash
# Check database connections
# This depends on your database provider's monitoring tools

# Temporary mitigation
vercel env add PRISMA_CONNECTION_LIMIT
# Set to lower value temporarily
```

**Performance Degradation**:
```sql
-- Check slow queries (PostgreSQL)
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Check database size
SELECT schemaname, tablename, 
       pg_total_relation_size(schemaname||'.'||tablename) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size DESC;
```

## Maintenance Procedures

### 1. Planned Deployments

**Pre-deployment Checklist**:
- [ ] All tests passing in CI
- [ ] Code review completed
- [ ] Database migrations reviewed
- [ ] Rollback plan prepared
- [ ] Monitoring alerts disabled (if needed)

**Deployment Process**:
```bash
# 1. Deploy to staging first
vercel --scope=staging

# 2. Run smoke tests on staging
curl https://staging-domain.com/health

# 3. Deploy to production
vercel --prod

# 4. Verify health check
curl https://production-domain.com/health

# 5. Monitor for 15 minutes post-deployment
vercel logs --follow
```

**Post-deployment**:
- [ ] Health checks passing
- [ ] User authentication working
- [ ] Key user flows tested
- [ ] Performance metrics normal
- [ ] Error rates within thresholds

### 2. Database Maintenance

**Weekly Tasks**:
```sql
-- Check database statistics
ANALYZE;

-- Review table sizes and growth
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;
```

**Monthly Tasks**:
- Review backup retention policies
- Analyze slow query performance
- Update database statistics
- Review user growth and capacity planning

### 3. Security Maintenance

**Weekly**:
- [ ] Review Dependabot security updates
- [ ] Check for new CVE reports affecting dependencies
- [ ] Review authentication failure logs
- [ ] Verify SSL certificate expiration dates

**Monthly**:
- [ ] Rotate JWT secrets (if required by policy)
- [ ] Review user access patterns
- [ ] Update security headers configuration
- [ ] Conduct security scan via CodeQL

## Performance Optimization

### Database Query Optimization

**Common Performance Issues**:
```sql
-- Missing indexes on search fields
CREATE INDEX CONCURRENTLY idx_user_email_search 
ON "User" USING gin(to_tsvector('english', email));

-- Optimize soft delete queries
CREATE INDEX CONCURRENTLY idx_user_active 
ON "User" (id) WHERE "isActive" = true;

-- Pagination optimization
CREATE INDEX CONCURRENTLY idx_user_created_id 
ON "User" ("createdAt" DESC, id);
```

### Function Cold Start Mitigation

**Keep Functions Warm** (if needed):
```bash
# Set up external ping service to key endpoints
# Ping every 5 minutes during business hours
curl https://your-domain.com/health
curl https://your-domain.com/api/users?page=1&size=1
```

### Frontend Performance

**Bundle Size Monitoring**:
```bash
# Check bundle size after builds
npm run build
ls -lh web/dist/assets/

# Set up alerts for bundle size increases > 20%
```

## Backup and Recovery Procedures

### Database Backup Verification

**Daily Verification**:
```bash
# For Vercel Postgres
# Check backup status in Vercel dashboard

# For external providers
# Use provider-specific backup verification commands
```

### Recovery Testing

**Monthly Recovery Test**:
1. Create test database instance
2. Restore latest backup
3. Verify data integrity
4. Test application connectivity
5. Document recovery time

### Application Recovery

**Complete Recovery Procedure**:
```bash
# 1. Prepare recovery environment
vercel env pull .env.recovery

# 2. Deploy known good version
vercel rollback [deployment-id]

# 3. Restore database if needed
# (Provider-specific commands)

# 4. Verify health
curl https://your-domain.com/health

# 5. Test critical user flows
# - Login/logout
# - User creation
# - User management operations
```

## Emergency Contacts

### On-Call Escalation

1. **Primary**: Development Team Lead
2. **Secondary**: DevOps Engineer  
3. **Database**: Database Administrator
4. **Security**: Security Team Lead

### Service Providers

- **Vercel Support**: https://vercel.com/support
- **Database Provider**: [Your provider support]
- **Domain Registrar**: [Your registrar support]
- **Monitoring Service**: [Your monitoring service]

### Communication Channels

- **Status Updates**: #incidents Slack channel
- **War Room**: Google Meet / Zoom link
- **Documentation**: Incident wiki/Notion page

## Capacity Planning

### Growth Metrics to Track

| Metric | Current | Growth Rate | Capacity Limit |
|--------|---------|-------------|----------------|
| Active Users | - | - | - |
| Database Size | - | - | - |
| Function Executions | - | - | - |
| API Requests/min | - | - | - |

### Scaling Triggers

**Database Scaling**:
- Connection usage > 80%
- Query response time > 500ms
- Storage usage > 80%

**Function Scaling**:
- Execution time > 20s consistently
- Memory usage > 90%
- Concurrent execution limits reached

### Cost Monitoring

**Monthly Cost Review**:
- Vercel function executions
- Database provider costs
- CDN bandwidth usage
- Third-party service costs

Set up billing alerts at:
- 50% of monthly budget
- 80% of monthly budget
- 100% of monthly budget

## Documentation Updates

This runbook should be updated:
- After each incident (lessons learned)
- When new monitoring tools are added
- When infrastructure changes are made
- Quarterly review for accuracy

Last Updated: [Current Date]
Next Review: [Date + 3 months]