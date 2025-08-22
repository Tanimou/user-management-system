# Database Schema & Migration Guide

This document provides comprehensive information about the database schema, migrations, and performance optimizations for the User Management System.

## 📋 Table of Contents

- [Schema Overview](#schema-overview)
- [Migration Management](#migration-management)
- [Performance Optimization](#performance-optimization)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

## 🗄️ Schema Overview

### User Model

The `User` model is the core entity of the system with the following structure:

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(120)
  email     String   @unique @db.VarChar(180)
  password  String   @db.VarChar(255)
  roles     String[] @default(["user"])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  avatarUrl String?  @db.VarChar(500)

  auditLogs AuditLog[]

  @@map("users")
  @@index([email])
  @@index([isActive])
  @@index([createdAt])
}
```

**Field Specifications:**
- `name`: Maximum 120 characters
- `email`: Maximum 180 characters, unique, automatically lowercased
- `password`: Maximum 255 characters (argon2id hash)
- `roles`: Array of strings, defaults to `["user"]`
- `avatarUrl`: Optional, maximum 500 characters

**Indexes:**
- Primary key on `id`
- Unique index on `email`
- Performance index on `isActive` (for filtering)
- Performance index on `createdAt` (for sorting)

### AuditLog Model

The `AuditLog` model tracks all user actions and system events:

```prisma
model AuditLog {
  id        Int      @id @default(autoincrement())
  actorId   Int?
  action    String   @db.VarChar(50)
  entity    String   @db.VarChar(50)
  entityId  Int?
  payload   Json?
  createdAt DateTime @default(now())

  actor User? @relation(fields: [actorId], references: [id])

  @@map("audit_logs")
  @@index([actorId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

**Field Specifications:**
- `action`: Maximum 50 characters (e.g., "CREATE", "UPDATE", "DELETE")
- `entity`: Maximum 50 characters (e.g., "User", "Role")
- `payload`: JSON field for storing additional context

**Indexes:**
- Primary key on `id`
- Index on `actorId` (for user activity queries)
- Composite index on `[entity, entityId]` (for entity-specific queries)
- Index on `createdAt` (for chronological queries)

## 🔄 Migration Management

### Available Commands

Use the migration script for common operations:

```bash
# Make script executable (first time only)
chmod +x scripts/migrate.sh

# Generate Prisma client
./scripts/migrate.sh generate

# Deploy migrations to production
./scripts/migrate.sh deploy

# Run database seed
./scripts/migrate.sh seed

# Open Prisma Studio
./scripts/migrate.sh studio

# Check migration status
./scripts/migrate.sh status
```

### Direct Prisma Commands

```bash
# Generate migration from schema changes
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

### Rollback Procedure

1. **Identify Migration to Rollback**
   ```bash
   ls -la prisma/migrations/
   ```

2. **Apply Rollback SQL**
   ```bash
   psql $DATABASE_URL -f prisma/migrations/[migration_name]/rollback.sql
   ```

3. **Update Migration History**
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = '[migration_name]';
   ```

⚠️ **Always backup your database before rolling back!**

## ⚡ Performance Optimization

### Database Indexes

The schema includes optimized indexes for common query patterns:

| Index | Purpose | Performance Impact |
|-------|---------|-------------------|
| `users_email_key` | Unique constraint + fast lookups | Login queries < 10ms |
| `users_isActive_idx` | Filter active/inactive users | Status filtering < 30ms |
| `users_createdAt_idx` | Chronological sorting | Pagination < 50ms |
| `audit_logs_actorId_idx` | User activity tracking | Activity queries < 100ms |
| `audit_logs_entity_entityId_idx` | Entity-specific audits | Entity queries < 100ms |

### Performance Benchmarks

Run performance tests to verify database optimization:

```bash
npm run db:performance
```

**Expected Performance:**
- User lookup by email: < 10ms
- User list with pagination: < 50ms
- User creation: < 100ms
- Complex search queries: < 200ms
- Concurrent connections: 50+ simultaneous

### Query Optimization Tips

1. **Use Select Fields**: Limit returned data
   ```typescript
   const users = await prisma.user.findMany({
     select: { id: true, name: true, email: true }
   });
   ```

2. **Implement Cursor Pagination**: For large datasets
   ```typescript
   const users = await prisma.user.findMany({
     take: 10,
     cursor: { id: lastUserId },
     orderBy: { id: 'asc' }
   });
   ```

3. **Filter at Database Level**: Use `where` clauses
   ```typescript
   const activeUsers = await prisma.user.findMany({
     where: { isActive: true }
   });
   ```

## 🔧 Environment Configuration

### Database Connection

Set the following environment variables:

```bash
# Production
DATABASE_URL="postgresql://user:password@host:port/database"

# Development  
DATABASE_URL="postgresql://user:password@localhost:5432/user_management_dev"

# Test
DATABASE_URL_TEST="postgresql://user:password@localhost:5432/user_management_test"
```

### Prisma Client Configuration

The Prisma client is configured for serverless optimization:

```typescript
// api/lib/prisma.ts
export const prisma = global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

**Features:**
- Singleton pattern for serverless environments
- Development query logging
- Graceful shutdown handling
- Connection pooling (built-in with Prisma)

### Connection Pooling

Prisma handles connection pooling automatically:
- **Development**: 5 connections
- **Production**: 10-20 connections (configurable via DATABASE_URL)
- **Serverless**: Optimized for function lifecycle

## 🐛 Troubleshooting

### Common Issues

**1. Migration Failures**
```bash
# Check migration status
npx prisma migrate status

# Reset and retry (development only)
npx prisma migrate reset
```

**2. Connection Issues**
```bash
# Test database connection
npx prisma db pull

# Check connection string format
echo $DATABASE_URL
```

**3. Schema Drift**
```bash
# Regenerate client after schema changes
npx prisma generate

# Create new migration
npx prisma migrate dev
```

**4. Performance Issues**
```bash
# Run performance benchmarks
npm run db:performance

# Check query logs (development)
# Set NODE_ENV=development for detailed logging
```

### Error Scenarios & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `P2002: Unique constraint failed` | Duplicate email | Validate uniqueness before insert |
| `P2025: Record not found` | Invalid user ID | Check existence before operations |
| `Connection timeout` | Pool exhaustion | Implement retry logic |
| `Migration failed` | Schema conflict | Review migration and fix conflicts |

## 📊 Monitoring & Maintenance

### Health Checks

The `/health` endpoint includes database connectivity:

```bash
curl https://your-app.vercel.app/api/health
```

### Regular Maintenance

1. **Monitor Connection Pool**: Watch for connection exhaustion
2. **Review Query Performance**: Use development logs
3. **Update Statistics**: Run `ANALYZE` on production tables periodically
4. **Backup Verification**: Test backup restoration procedures

### Security Considerations

- Use parameterized queries (Prisma handles this automatically)
- Implement row-level security if needed
- Regular security updates for PostgreSQL
- Monitor for unusual query patterns
- Encrypt database connections (SSL/TLS)

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [Database Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)

---

For questions or issues, please refer to the project's GitHub repository or create an issue.