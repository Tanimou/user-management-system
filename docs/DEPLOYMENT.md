# Deployment Guide

This guide covers deploying the User Management System to production on Vercel with PostgreSQL.

## Prerequisites

- Vercel account with CLI installed: `npm i -g vercel`
- PostgreSQL database (Vercel Postgres, Neon, or other provider)
- Domain name (optional)
- GitHub repository connected to Vercel

## Environment Setup

### 1. Database Setup

**Option A: Vercel Postgres (Recommended)**
```bash
# In your Vercel dashboard
vercel postgres create user-management-db
```

**Option B: External PostgreSQL (Neon, RDS, etc.)**
- Create PostgreSQL 15+ database
- Note connection string format: `postgresql://user:pass@host:port/dbname`

### 2. Environment Variables

Set these in your Vercel project dashboard or via CLI:

```bash
# Required Production Variables
vercel env add DATABASE_URL
# Enter your production PostgreSQL connection string

vercel env add JWT_SECRET  
# Enter a strong secret (min 256 bits)

vercel env add FRONTEND_ORIGIN
# Enter your production domain (e.g., https://yourapp.vercel.app)

# Optional Variables
vercel env add LOG_LEVEL
# Enter: info

vercel env add NODE_ENV
# Enter: production
```

### 3. Vercel Project Configuration

Create `vercel.json` in project root (already included):
- Configures serverless functions
- Sets up routing and security headers
- Optimizes caching for static assets

## Deployment Process

### 1. Initial Deployment

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 2. Database Migration

```bash
# Set DATABASE_URL locally for migration
export DATABASE_URL="your-production-db-url"

# Run migrations
npm run db:migrate --workspace=api

# Or push schema directly (no migration files)
npm run db:push --workspace=api
```

### 3. Health Check

After deployment, verify health status:
```bash
curl https://your-domain.vercel.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "connected"
  }
}
```

## CI/CD Pipeline

The project includes GitHub Actions workflows:

### Automatic Deployment
- **Trigger**: Push to `main` branch
- **Process**: Build → Test → Deploy → Health Check
- **Required Secrets**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### Quality Gates
- All tests must pass
- TypeScript compilation successful  
- ESLint checks pass
- Security audit passes

## Post-Deployment Configuration

### 1. Custom Domain (Optional)

```bash
# Add custom domain
vercel domains add yourdomain.com

# Update FRONTEND_ORIGIN environment variable
vercel env add FRONTEND_ORIGIN
# Enter: https://yourdomain.com
```

### 2. SSL Certificate

Vercel automatically provisions SSL certificates for:
- *.vercel.app domains
- Custom domains (after DNS verification)

### 3. Monitoring Setup

**Health Monitoring**:
- Monitor `/health` endpoint
- Set up alerts for 5xx responses
- Monitor response times < 2s

**Error Tracking** (Optional):
```bash
# Add Sentry for error tracking
vercel env add SENTRY_DSN
# Enter your Sentry project DSN
```

## Scaling Configuration

### Function Settings
Current configuration (in `vercel.json`):
- **Memory**: 1024 MB
- **Timeout**: 30 seconds
- **Runtime**: Node.js 18+

### Database Scaling
- **Connection Pooling**: Built into Prisma
- **Query Optimization**: Indexes on email, createdAt
- **Soft Deletes**: Improves performance vs hard deletes

## Security Configuration

### 1. Security Headers
Automatically applied via `vercel.json`:
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- HSTS for custom domains

### 2. CORS Configuration
- Restricted to FRONTEND_ORIGIN only
- Credentials allowed for auth cookies
- Preflight handling for complex requests

### 3. Authentication Security
- JWT secrets min 256 bits
- Access tokens: 15 minutes
- Refresh tokens: 7 days with rotation
- Argon2id password hashing

## Backup and Recovery

### Database Backups
- **Vercel Postgres**: Automatic daily backups
- **External DB**: Configure provider backup schedule
- **Point-in-time recovery**: Available with most providers

### Application Recovery
- **Rollback**: Use Vercel dashboard or `vercel rollback`
- **RTO (Recovery Time Objective)**: < 15 minutes
- **RPO (Recovery Point Objective)**: < 1 hour

### Disaster Recovery Procedure
1. Identify issue via monitoring alerts
2. Check deployment status in Vercel dashboard
3. Review logs: `vercel logs`
4. Rollback if necessary: `vercel rollback`
5. Database restore if needed (contact provider)

## Performance Optimization

### Frontend Optimization
- Asset compression and CDN via Vercel
- Code splitting (consider implementing)
- Service worker caching (future enhancement)

### Backend Optimization  
- Database connection pooling (Prisma default)
- Query optimization with indexes
- Function warming for reduced cold starts

### Monitoring Metrics
- **Response Times**: < 2000ms (API endpoints)
- **Error Rate**: < 1%
- **Database Query Time**: < 500ms
- **Memory Usage**: < 80% of allocated

## Troubleshooting

### Common Issues

**1. Database Connection Issues**
```bash
# Test connection
vercel env ls
# Verify DATABASE_URL is set correctly

# Check logs
vercel logs --follow
```

**2. Build Failures**
```bash
# Local build test
npm run build

# Check Node.js version compatibility
node --version  # Should be 18+
```

**3. Environment Variables**
```bash
# List all environment variables
vercel env ls

# Pull environment to local .env
vercel env pull
```

**4. CORS Issues**
- Verify FRONTEND_ORIGIN matches exact domain
- Check browser network tab for preflight requests
- Ensure credentials: true for auth requests

### Support Contacts
- **Vercel Support**: https://vercel.com/support
- **Database Provider**: Check your provider's support
- **Project Maintainer**: Create GitHub issue

## Cost Optimization

### Vercel Usage
- **Function Executions**: Optimize query efficiency
- **Bandwidth**: Enable compression for API responses
- **Build Minutes**: Use build caching

### Database Usage
- **Connection Limits**: Use connection pooling
- **Query Optimization**: Add database indexes
- **Storage**: Implement data archiving strategy

## Security Checklist

- [ ] Strong JWT secrets in production
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] CORS restricted to production domain
- [ ] Database credentials secured
- [ ] Security headers configured
- [ ] Dependencies regularly updated (Dependabot)
- [ ] Code security scanned (CodeQL)
- [ ] Access logs monitored