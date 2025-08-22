# Logging and Monitoring Strategy

## Structured Logging Implementation

### Log Levels
- **ERROR**: Application errors, exceptions, critical failures
- **WARN**: Potential issues, deprecated features, performance warnings
- **INFO**: Normal application flow, user actions, system events
- **DEBUG**: Detailed diagnostic information (development only)

### Log Format
All logs should follow this structured format:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "User login successful",
  "service": "user-management-api",
  "module": "auth",
  "userId": "123",
  "email": "user@example.com",
  "requestId": "req-12345",
  "duration": 150,
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### Security-Sensitive Data Redaction

**Always Redact**:
- Passwords (hashed or plaintext)
- JWT tokens
- Session cookies
- Credit card numbers
- Social Security Numbers
- API keys and secrets

**Example Implementation**:
```typescript
// In your logging utility
function sanitizeForLogging(data: any): any {
  const sensitiveFields = ['password', 'token', 'jwt', 'cookie', 'secret'];
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  return data;
}
```

## Application Logging Points

### Authentication Events
```typescript
// Login attempt
logger.info('Login attempt', {
  email: user.email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  success: true
});

// Failed login
logger.warn('Login failed', {
  email: attemptedEmail,
  reason: 'invalid_credentials',
  ip: req.ip,
  userAgent: req.headers['user-agent']
});

// Token refresh
logger.info('Token refresh', {
  userId: user.id,
  ip: req.ip
});
```

### User Management Events
```typescript
// User creation
logger.info('User created', {
  userId: newUser.id,
  email: newUser.email,
  roles: newUser.roles,
  createdBy: currentUser.id
});

// User modification
logger.info('User updated', {
  userId: updatedUser.id,
  changes: changedFields,
  updatedBy: currentUser.id
});

// User deactivation
logger.warn('User deactivated', {
  userId: user.id,
  email: user.email,
  deactivatedBy: currentUser.id,
  reason: 'admin_action'
});
```

### Error Logging
```typescript
// Database errors
logger.error('Database operation failed', {
  operation: 'user_create',
  error: error.message,
  stack: error.stack,
  userId: currentUser?.id
});

// Authorization failures
logger.warn('Unauthorized access attempt', {
  userId: user?.id,
  requiredRoles: ['admin'],
  userRoles: user?.roles,
  endpoint: req.url,
  method: req.method
});
```

## Performance Monitoring

### Response Time Logging
```typescript
// Middleware to log response times
export function logResponseTime(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip
    });
    
    // Warn on slow requests
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        userId: req.user?.id
      });
    }
  });
  
  next();
}
```

### Database Query Monitoring
```typescript
// Monitor slow queries
export function logSlowQueries() {
  // This would be implemented as Prisma middleware
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    
    const duration = after - before;
    
    if (duration > 500) {
      logger.warn('Slow database query', {
        model: params.model,
        action: params.action,
        duration,
        args: sanitizeForLogging(params.args)
      });
    }
    
    return result;
  });
}
```

## Error Tracking and Alerting

### Error Categories
1. **Critical**: System down, data loss, security breach
2. **High**: Core functionality broken, authentication issues
3. **Medium**: Feature degradation, performance issues
4. **Low**: UI glitches, minor bugs

### Alerting Thresholds
| Metric | Warning | Critical | Action |
|--------|---------|----------|---------|
| Error Rate | > 1% | > 5% | Investigate immediately |
| Response Time | > 2s | > 5s | Performance review |
| Failed Logins | > 10/min | > 50/min | Security investigation |
| Database Errors | > 1/min | > 5/min | Database health check |

### Integration Points

**Sentry Setup** (Recommended):
```typescript
import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

// Error reporting
export function reportError(error: Error, context?: any) {
  Sentry.captureException(error, {
    extra: sanitizeForLogging(context)
  });
  
  logger.error('Exception reported to Sentry', {
    message: error.message,
    stack: error.stack,
    context: sanitizeForLogging(context)
  });
}
```

## Log Storage and Retention

### Vercel Logs
- **Retention**: 7 days for Hobby, 30 days for Pro
- **Access**: `vercel logs` CLI command
- **Real-time**: `vercel logs --follow`

### External Log Aggregation (Recommended)
Options for longer retention:
1. **DataDog**: Full APM + logging
2. **LogDNA/Mezmo**: Specialized logging
3. **Splunk**: Enterprise logging
4. **ELK Stack**: Self-hosted option

### Log Retention Policy
| Log Type | Retention Period | Storage Location |
|----------|------------------|------------------|
| Access Logs | 90 days | Vercel + External |
| Error Logs | 1 year | External service |
| Security Events | 2 years | External service |
| Audit Logs | 7 years | External service |

## Compliance and Audit Trail

### GDPR Compliance
- User data access requests
- Right to be forgotten implementation
- Data processing logs
- Consent management logging

### Security Audit Requirements
```typescript
// Audit log entry format
interface AuditLogEntry {
  timestamp: string;
  actor: string; // User ID who performed action
  action: string; // What was done
  resource: string; // What was affected
  resourceId: string; // Specific resource identifier
  ip: string;
  userAgent: string;
  success: boolean;
  reason?: string; // For failures
}

// Example audit log
logger.info('Audit: User role changed', {
  actor: currentUser.id,
  action: 'role_change',
  resource: 'user',
  resourceId: targetUser.id,
  oldRoles: oldRoles,
  newRoles: newRoles,
  ip: req.ip,
  success: true
});
```

## Dashboard and Visualization

### Key Metrics Dashboard
1. **System Health**
   - Response times (95th percentile)
   - Error rates by endpoint
   - Database query performance
   - Function execution metrics

2. **User Activity**
   - Active users (daily/monthly)
   - Login success/failure rates
   - Feature usage statistics
   - Geographic distribution

3. **Security Metrics**
   - Failed login attempts
   - Password reset requests
   - Role changes
   - Suspicious activity patterns

### Implementation Options
- **Vercel Analytics**: Built-in metrics
- **Grafana + Prometheus**: Custom dashboards
- **DataDog Dashboards**: All-in-one monitoring
- **Custom Vercel Functions**: Export metrics to external systems

## Development vs Production Logging

### Development Environment
- **Level**: DEBUG
- **Output**: Console with colors
- **Format**: Human-readable
- **Sensitive Data**: Redacted but more verbose

### Production Environment  
- **Level**: INFO
- **Output**: JSON to stdout (collected by Vercel)
- **Format**: Structured JSON
- **Sensitive Data**: Strictly redacted
- **Sampling**: Consider sampling high-volume logs

### Configuration
```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const logConfig = {
  level: isDevelopment ? 'DEBUG' : 'INFO',
  format: isDevelopment ? 'pretty' : 'json',
  redactionLevel: isDevelopment ? 'partial' : 'strict'
};
```

## Best Practices

### Do's
- ✅ Use structured logging with consistent fields
- ✅ Include request IDs for tracing
- ✅ Log both successes and failures
- ✅ Use appropriate log levels
- ✅ Include context information
- ✅ Sanitize sensitive data
- ✅ Monitor log volume and costs

### Don'ts
- ❌ Log passwords or tokens
- ❌ Use only console.log in production
- ❌ Log excessive debug information in production
- ❌ Ignore log rotation and retention
- ❌ Log personally identifiable information unnecessarily
- ❌ Block application execution for logging
- ❌ Forget to test logging in CI/CD pipeline

### Performance Considerations
- Use asynchronous logging where possible
- Buffer logs for batch processing
- Consider log sampling for high-volume operations
- Monitor logging overhead on function execution time
- Use appropriate log levels to control volume