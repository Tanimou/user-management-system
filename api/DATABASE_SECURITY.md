# Database Security Configuration Guide

This document outlines comprehensive security configuration requirements and best practices for the User Management System's production database.

## 🔒 Security Overview

The production database requires multi-layered security covering:
- **Connection Security**: SSL/TLS encryption and secure authentication
- **Access Control**: User permissions and role-based access
- **Network Security**: Firewall rules and IP whitelisting
- **Data Protection**: Encryption at rest and in transit
- **Monitoring**: Audit logging and intrusion detection

## 🌐 Connection Security

### 1. SSL/TLS Configuration

#### Required SSL Settings
All database connections MUST use SSL/TLS encryption:

```bash
# Environment variable format
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# For enhanced security (recommended for production)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=verify-full&sslcert=client.crt&sslkey=client.key&sslrootcert=ca.crt"
```

#### Provider-Specific SSL Configuration

**Vercel Postgres**:
- SSL enabled by default
- Managed certificates
- TLS 1.2+ enforced

```bash
# Vercel Postgres connection (SSL automatic)
DATABASE_URL="postgresql://username:password@region-pooler.vercel-pool.com:5432/database"
```

**Neon**:
- SSL required by default
- TLS 1.2+ with perfect forward secrecy
- Certificate verification available

```bash
# Neon connection with SSL verification
DATABASE_URL="postgresql://user:password@host.neon.tech:5432/database?sslmode=require"
```

**AWS RDS**:
```sql
-- Enable SSL enforcement
ALTER USER myuser WITH CREATEDB NOLOGIN CONNECTION LIMIT 100 ENCRYPTED PASSWORD 'secure_password';
GRANT rds_ssl TO myuser;

-- Force SSL connections
ALTER DATABASE mydatabase SET log_connections = on;
ALTER DATABASE mydatabase SET log_statement = 'all';
```

**Google Cloud SQL**:
```bash
# Connection with SSL
DATABASE_URL="postgresql://user:password@host/database?sslmode=require&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=server-ca.pem"
```

### 2. Certificate Management

#### Production Certificate Setup
```bash
#!/bin/bash
# setup-ssl-certs.sh

# Create certificate directory
mkdir -p /etc/ssl/postgresql

# Generate client certificate (if using mutual TLS)
openssl genrsa -out client-key.pem 2048
openssl req -new -key client-key.pem -out client-req.pem
openssl x509 -req -in client-req.pem -days 365 -CA ca-cert.pem -CAkey ca-key.pem -out client-cert.pem

# Set proper permissions
chmod 600 client-key.pem
chmod 644 client-cert.pem ca-cert.pem

# Verify certificate
openssl x509 -in client-cert.pem -text -noout
```

## 👥 User Access Control

### 1. Database User Accounts

#### Application User (Minimal Privileges)
```sql
-- Create application user with minimal required privileges
CREATE USER app_user WITH ENCRYPTED PASSWORD 'secure_random_password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE user_management_prod TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Table-specific permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO app_user;
GRANT SELECT, INSERT ON TABLE audit_logs TO app_user;

-- Sequence permissions (for auto-incrementing IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- No administrative privileges
-- No superuser privileges
-- No database creation privileges
```

#### Read-Only User (Analytics/Reporting)
```sql
-- Create read-only user for analytics
CREATE USER analytics_user WITH ENCRYPTED PASSWORD 'analytics_secure_password';

GRANT CONNECT ON DATABASE user_management_prod TO analytics_user;
GRANT USAGE ON SCHEMA public TO analytics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;

-- Ensure future tables are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics_user;
```

#### Backup User (Backup Operations)
```sql
-- Create backup user
CREATE USER backup_user WITH ENCRYPTED PASSWORD 'backup_secure_password';

GRANT CONNECT ON DATABASE user_management_prod TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;

-- For pg_dump operations
ALTER USER backup_user CREATEDB;
```

### 2. Password Security

#### Password Requirements
- **Minimum length**: 16 characters
- **Complexity**: Mix of uppercase, lowercase, numbers, and special characters
- **Rotation**: Every 90 days for production systems
- **Storage**: Use environment variables or secure secret management

#### Password Generation
```bash
# Generate secure passwords
openssl rand -base64 32

# Or using pwgen
pwgen -s 32 1

# Store in environment variables
export DB_APP_PASSWORD="$(openssl rand -base64 32)"
export DB_ANALYTICS_PASSWORD="$(openssl rand -base64 32)"
export DB_BACKUP_PASSWORD="$(openssl rand -base64 32)"
```

### 3. Role-Based Access Control

#### Database Roles Setup
```sql
-- Create roles for different access levels
CREATE ROLE app_read;
CREATE ROLE app_write;
CREATE ROLE app_admin;

-- Grant permissions to roles
GRANT USAGE ON SCHEMA public TO app_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read;

GRANT app_read TO app_write;
GRANT INSERT, UPDATE, DELETE ON TABLE users TO app_write;
GRANT INSERT ON TABLE audit_logs TO app_write;

GRANT app_write TO app_admin;
GRANT CREATE ON SCHEMA public TO app_admin;

-- Assign roles to users
GRANT app_write TO app_user;
GRANT app_read TO analytics_user;
```

## 🔥 Network Security

### 1. Firewall Configuration

#### IP Whitelisting
Configure database firewall to allow connections only from:
- Application servers (Vercel regions)
- Developer workstations (specific IPs)
- Monitoring systems
- Backup services

#### Example Firewall Rules

**AWS RDS Security Groups**:
```json
{
  "SecurityGroupRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 5432,
      "ToPort": 5432,
      "CidrIp": "76.76.19.0/24",
      "Description": "Vercel Region US-East"
    },
    {
      "IpProtocol": "tcp", 
      "FromPort": 5432,
      "ToPort": 5432,
      "CidrIp": "76.76.21.0/24",
      "Description": "Vercel Region US-West"
    }
  ]
}
```

**Google Cloud SQL**:
```bash
# Add authorized networks
gcloud sql instances patch INSTANCE_NAME \
  --authorized-networks=76.76.19.0/24,76.76.21.0/24
```

### 2. VPC Configuration (Optional)

For enhanced security, deploy database in a Virtual Private Cloud:

```bash
# AWS RDS in VPC
aws rds create-db-instance \
  --db-instance-identifier mydb \
  --db-subnet-group-name private-subnet-group \
  --vpc-security-group-ids sg-12345678 \
  --no-publicly-accessible
```

## 🔐 Data Encryption

### 1. Encryption at Rest

#### Provider Configuration

**Vercel Postgres**:
- AES-256 encryption enabled by default
- Managed encryption keys
- No additional configuration required

**AWS RDS**:
```bash
# Enable encryption at rest
aws rds create-db-instance \
  --db-instance-identifier encrypted-db \
  --storage-encrypted \
  --kms-key-id arn:aws:kms:region:account:key/key-id
```

**Google Cloud SQL**:
```bash
# Enable encryption with customer-managed keys
gcloud sql instances create encrypted-instance \
  --disk-encryption-key=projects/PROJECT_ID/locations/LOCATION/keyRings/RING_NAME/cryptoKeys/KEY_NAME
```

### 2. Encryption in Transit

All connections use TLS 1.2+ with strong cipher suites:

```javascript
// Prisma configuration for enhanced security
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?sslmode=require&sslcert=client.crt&sslkey=client.key'
    }
  }
});
```

### 3. Application-Level Encryption

For sensitive data fields:

```typescript
// Example: Encrypt sensitive fields before storage
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY; // 32 bytes key

export function encryptSensitiveData(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptSensitiveData(encryptedData: string): string {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

## 📊 Audit and Monitoring

### 1. Database Audit Logging

#### Enable PostgreSQL Logging
```sql
-- Enable comprehensive logging
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second

-- Reload configuration
SELECT pg_reload_conf();
```

#### Application-Level Audit Trail
```typescript
// Enhanced audit logging in application
export async function logDatabaseOperation(
  userId: number | null,
  operation: string,
  table: string,
  recordId: number | null,
  changes: any
) {
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: operation,
      entity: table,
      entityId: recordId,
      payload: {
        changes,
        timestamp: new Date().toISOString(),
        clientIp: getClientIp(),
        userAgent: getUserAgent()
      }
    }
  });
}
```

### 2. Security Monitoring

#### Failed Login Attempts
```sql
-- Track failed authentication attempts
CREATE TABLE security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  client_ip INET,
  user_email VARCHAR(180),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_ip ON security_events(client_ip);
```

#### Anomaly Detection
```typescript
// Monitor for suspicious activity
export async function detectAnomalies(): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = [];
  
  // Check for excessive failed logins
  const failedLogins = await prisma.securityEvent.count({
    where: {
      eventType: 'FAILED_LOGIN',
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      }
    }
  });
  
  if (failedLogins > 10) {
    alerts.push({
      type: 'BRUTE_FORCE_ATTEMPT',
      severity: 'HIGH',
      message: `${failedLogins} failed login attempts in 15 minutes`
    });
  }
  
  // Check for unusual data access patterns
  const largeQueries = await prisma.auditLog.count({
    where: {
      action: 'SELECT_BULK',
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      }
    }
  });
  
  if (largeQueries > 5) {
    alerts.push({
      type: 'BULK_DATA_ACCESS',
      severity: 'MEDIUM',
      message: `Unusual bulk data access detected`
    });
  }
  
  return alerts;
}
```

## ⚠️ Security Checklist

### Pre-Deployment Security Verification

- [ ] **SSL/TLS enabled** for all database connections
- [ ] **Strong passwords** generated for all database users
- [ ] **Minimal privileges** assigned to application users
- [ ] **Firewall rules** configured to restrict access
- [ ] **Audit logging** enabled at database level
- [ ] **Application audit trail** implemented
- [ ] **Backup encryption** enabled
- [ ] **Network isolation** configured (VPC if applicable)
- [ ] **Certificate management** process documented
- [ ] **Security monitoring** alerts configured

### Ongoing Security Maintenance

- [ ] **Regular password rotation** (every 90 days)
- [ ] **Security patch updates** for database software
- [ ] **Access review** quarterly for all database users
- [ ] **Firewall rule review** monthly
- [ ] **Audit log analysis** weekly
- [ ] **Security incident response** plan tested
- [ ] **Vulnerability scanning** monthly
- [ ] **Certificate expiration monitoring**

## 🚨 Incident Response

### 1. Security Breach Response

#### Immediate Actions
```bash
#!/bin/bash
# security-incident-response.sh

echo "🚨 Security Incident Response"

# 1. Isolate the affected system
echo "1. Isolating database access..."
# Temporarily block all non-essential access

# 2. Collect forensic evidence
echo "2. Collecting evidence..."
pg_dump $DATABASE_URL > incident_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Analyze security events
echo "3. Analyzing security events..."
psql $DATABASE_URL -c "
SELECT event_type, client_ip, COUNT(*), MAX(created_at) 
FROM security_events 
WHERE created_at > NOW() - INTERVAL '24 hours' 
GROUP BY event_type, client_ip 
ORDER BY COUNT(*) DESC;
"

# 4. Reset compromised credentials
echo "4. Resetting credentials..."
# Generate new passwords and rotate keys
```

### 2. Recovery Procedures

#### Post-Incident Steps
1. **Damage Assessment**: Determine scope of compromise
2. **Credential Rotation**: Reset all database passwords
3. **Certificate Renewal**: Issue new SSL certificates if needed
4. **Access Review**: Audit and revoke unnecessary access
5. **System Hardening**: Apply additional security measures
6. **Monitoring Enhancement**: Increase logging and alerting

## 📚 Compliance Requirements

### 1. Data Protection Regulations

#### GDPR Compliance
- **Data Minimization**: Store only necessary user data
- **Right to be Forgotten**: Implement secure data deletion
- **Data Portability**: Provide user data export functionality
- **Breach Notification**: Alert authorities within 72 hours

#### CCPA Compliance
- **Data Transparency**: Document data collection and usage
- **Data Sale Prohibition**: Ensure no user data is sold
- **Access Rights**: Provide user data access mechanisms

### 2. Security Standards

#### SOC 2 Type II
- **Security Controls**: Implement comprehensive security measures
- **Availability Controls**: Ensure system uptime and performance
- **Processing Integrity**: Maintain data accuracy and completeness
- **Confidentiality**: Protect sensitive information
- **Privacy**: Safeguard personal information

## 🔗 Related Documentation

- [Database Schema & Migration Guide](DATABASE_SCHEMA.md)
- [Backup and Recovery Procedures](BACKUP_RECOVERY.md)
- [Operations Runbook](../docs/OPERATIONS.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)

---

**⚠️ Security Notice**: This document contains security-sensitive information. Restrict access to authorized personnel only and keep documentation updated with any security changes.