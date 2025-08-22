# Production Deployment Guide

This guide provides step-by-step instructions for deploying the User Management System to Vercel.

## Prerequisites

- Vercel account with CLI installed: `npm i -g vercel`
- PostgreSQL database (Vercel Postgres, Neon, or other provider)
- Domain name (optional)
- GitHub repository connected to Vercel

## Environment Variables

Set the following environment variables in your Vercel dashboard:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:port/dbname"

# JWT Configuration  
JWT_ACCESS_SECRET="[64-character random string]"
JWT_REFRESH_SECRET="[64-character random string]"
JWT_ACCESS_TTL_SECONDS="900"
JWT_REFRESH_TTL_SECONDS="604800"

# CORS Configuration
FRONTEND_ORIGIN="https://your-app.vercel.app"

# Optional: External Services
UPSTASH_REDIS_URL="rediss://..."
VERCEL_BLOB_READ_WRITE_TOKEN="..."

# Optional: Monitoring
SENTRY_DSN="..."
LOG_LEVEL="info"
```

## Deployment Steps

### 1. Connect to Vercel

```bash
# Login to Vercel
vercel login

# Link project (run from project root)
vercel link
```

### 2. Deploy to Production

```bash
# Deploy to production
npm run deploy

# Or manually
vercel --prod
```

### 3. Run Database Migration

After deployment, run the production migration:

```bash
# Set environment variables and run migration
npm run migrate:prod
```

### 4. Verify Deployment

1. Check health endpoint: `https://your-app.vercel.app/health`
2. Test authentication flow
3. Verify database connectivity

## Monitoring

- Health endpoint: `/health`
- Monitor response times (< 2s)
- Set up alerts for 5xx responses
- Monitor database query performance

## Security Configuration

- HTTPS is automatically enforced by Vercel
- Security headers are configured in `vercel.json`
- CORS is restricted to production domain
- JWT secrets should be 256+ bits

## Post-Deployment Checklist

- [ ] Health check endpoint responds correctly
- [ ] Authentication flow works end-to-end
- [ ] Database connectivity verified
- [ ] Default admin user created
- [ ] Security headers properly configured
- [ ] Performance metrics within targets
- [ ] Error monitoring operational

## Troubleshooting

### Common Issues

1. **Build Failures**: Check that all dependencies are installed
2. **Database Connection**: Verify DATABASE_URL format and credentials
3. **CORS Issues**: Ensure FRONTEND_ORIGIN matches your domain
4. **Function Timeouts**: Check function execution time in Vercel dashboard

### Support

- Vercel Functions Documentation
- Database provider documentation
- GitHub Issues for project-specific problems

## Performance Targets

- API response time: < 2 seconds (95th percentile)
- Frontend load time: < 3 seconds
- Database query time: < 500ms average
- Support for 100+ concurrent users