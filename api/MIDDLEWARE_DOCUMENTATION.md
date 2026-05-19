# Authentication & Security Middleware System

## Overview

This document describes the comprehensive authentication and security middleware system implemented to meet the requirements of Issue #21. The system provides decorator-style middleware components that can be easily composed for different endpoints.

## Architecture

### Core Principles

1. **Decorator Pattern**: All middleware follow a consistent decorator pattern allowing easy composition
2. **Type Safety**: Full TypeScript support with proper type definitions
3. **Security First**: Built-in security controls and headers
4. **Composability**: Middleware can be easily combined and reused
5. **Performance**: Optimized for minimal overhead and caching where appropriate

### Middleware Components

#### 1. Authentication Middleware (`enhanced-auth.ts`)

```typescript
import { withAuth } from '../lib/middleware/auth.js';

const handler = withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  // req.user is now available with validated user data
  res.json({ user: req.user });
});
```

**Features:**
- Bearer token extraction and validation
- JWT signature verification with proper error handling
- User context injection with active user verification
- Performance optimized with database lookup only when needed
- Malformed token error handling with appropriate HTTP status codes

#### 2. Authorization Middleware (`authorize.ts`)

```typescript
import { withRoles, withAdminRole, withSelfOrAdmin, preventSelfDemotion } from '../lib/middleware/auth.js';

// Role-based access control
const adminHandler = withAdminRole(handler);
const userHandler = withRoles(['user', 'admin'])(handler);

// Self-resource access validation
const profileHandler = withSelfOrAdmin(req => req.query.id)(handler);

// Prevent admin privilege escalation
const updateUserHandler = preventSelfDemotion(handler);
```

**Features:**
- Flexible role-based access control (RBAC)
- Self-resource access validation
- Admin privilege escalation prevention
- Admin self-demotion and self-deactivation protection

#### 3. Security Middleware (`security.ts`)

```typescript
import { withCORS } from '../lib/middleware/auth.js';

const handler = withCORS(async (req: VercelRequest, res: VercelResponse) => {
  // CORS and security headers automatically applied
  res.json({ message: 'Protected endpoint' });
});
```

**Features:**
- Strict CORS configuration with environment-specific origins
- Comprehensive security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Automatic OPTIONS request handling
- Content Security Policy configuration

#### 4. Error Handling Middleware (`errors.ts`)

```typescript
import { withErrorHandling, AppError } from '../lib/middleware/auth.js';

const handler = withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  // Any errors thrown will be automatically handled
  throw new AppError(400, 'Custom validation error');
});
```

**Features:**
- Standardized error response format
- Security-conscious error messages (no sensitive data exposure)
- Prisma error handling with appropriate HTTP status codes
- Custom application error support
- Comprehensive error logging for security auditing

#### 5. Request Validation Middleware (`validation.ts`)

```typescript
import { validateBody, validateQuery } from '../lib/middleware/auth.js';
import { createUserSchema, getUsersSchema } from '../lib/schemas/user.js';

const createUserHandler = validateBody(createUserSchema)(handler);
const getUsersHandler = validateQuery(getUsersSchema)(handler);
```

**Features:**
- Joi-based validation with comprehensive schemas
- Input sanitization and transformation
- Detailed validation error messages
- Query parameter and request body validation
- Type coercion and default values

### Middleware Composition

The system allows easy composition of multiple middleware components:

```typescript
import { 
  withCORS, 
  withErrorHandling, 
  withAuth, 
  withAdminRole, 
  validateQuery,
  preventSelfDemotion 
} from '../lib/middleware/auth.js';

const handler = withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        preventSelfDemotion(
          validateQuery(getUsersSchema)(
            async (req: AuthenticatedRequest, res: VercelResponse) => {
              // Fully protected handler with validation
              const users = await getUsersWithPagination(req.query);
              res.json(users);
            }
          )
        )
      )
    )
  )
);
```

### Security Features

#### JWT Authentication
- **Token Verification**: Proper JWT signature verification and expiry checking
- **User Validation**: Active user verification on each request
- **Error Handling**: Comprehensive error messages for different token failure scenarios

#### Authorization Controls
- **Role-Based Access**: Flexible RBAC system supporting admin/user roles
- **Self-Resource Access**: Users can only modify their own data unless admin
- **Privilege Protection**: Prevents admin self-demotion and self-deactivation

#### Security Headers
- **CORS Protection**: Strict origin validation
- **XSS Prevention**: X-XSS-Protection and Content Security Policy
- **Clickjacking Protection**: X-Frame-Options header
- **Content Type Protection**: X-Content-Type-Options header

#### Input Validation
- **Schema Validation**: Comprehensive Joi schemas for all inputs
- **Sanitization**: Automatic input cleaning and transformation
- **Type Safety**: Proper TypeScript integration

### Performance Optimizations

1. **Caching**: User data is cached in request context to avoid repeated database calls
2. **Minimal Overhead**: Middleware composition has minimal performance impact
3. **Early Returns**: Authentication and authorization failures return immediately
4. **Efficient Validation**: Joi validation with optimized schemas

### Usage Examples

#### Basic Protected Endpoint
```typescript
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.json({ message: `Hello ${req.user.name}` });
});
```

#### Admin-Only Endpoint with Validation
```typescript
export default withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        validateBody(createUserSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            const user = await createUser(req.body);
            res.json(user);
          }
        )
      )
    )
  )
);
```

#### Self-Resource Update with Protection
```typescript
export default withCORS(
  withErrorHandling(
    withAuth(
      withSelfOrAdmin(req => req.query.id)(
        preventSelfDemotion(
          validateBody(updateUserSchema)(
            async (req: AuthenticatedRequest, res: VercelResponse) => {
              const user = await updateUser(Number(req.query.id), req.body);
              res.json(user);
            }
          )
        )
      )
    )
  )
);
```

## Testing

Comprehensive test suite covers all middleware components:

- **Authentication Tests**: Token validation, error handling, user context injection
- **Authorization Tests**: Role-based access, self-resource validation, privilege protection
- **Security Tests**: CORS headers, security headers, OPTIONS handling
- **Error Handling Tests**: Custom errors, Prisma errors, validation errors
- **Validation Tests**: Schema validation, input transformation, error messages

Run tests with:
```bash
npm test tests/middleware.test.ts
```

## Migration Guide

### Existing Endpoints

Existing endpoints can be gradually migrated to use the new middleware system:

**Before:**
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORSHeaders(res);
  setSecurityHeaders(res);
  
  if (!await requireAuth(req, res)) return;
  if (!await requireAdmin(req, res)) return;
  
  // Handler logic
}
```

**After:**
```typescript
export default withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        async (req: AuthenticatedRequest, res: VercelResponse) => {
          // Handler logic
        }
      )
    )
  )
);
```

### Benefits of Migration

1. **Cleaner Code**: More readable and maintainable
2. **Better Error Handling**: Consistent error responses
3. **Type Safety**: Better TypeScript support
4. **Composability**: Easy to add/remove middleware layers
5. **Testing**: Easier to test individual middleware components

## Best Practices

1. **Always use `withCORS`** for public endpoints
2. **Combine `withErrorHandling`** with other middleware for consistent error responses
3. **Use specific validation schemas** for each endpoint
4. **Apply `preventSelfDemotion`** for admin user modification endpoints
5. **Layer middleware in logical order**: CORS → Error Handling → Auth → Authorization → Validation → Handler

## Security Considerations

1. **Token Validation**: All access tokens are verified for signature and expiry
2. **Active User Check**: Users must be active in the database
3. **Role Verification**: Roles are checked against current database state
4. **Input Sanitization**: All inputs are validated and sanitized
5. **Error Information**: No sensitive data is exposed in error messages
6. **Audit Logging**: All security events are logged for monitoring