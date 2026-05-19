#!/bin/bash

# Production Database Migration Script for User Management System
# This script provides comprehensive database deployment procedures with safety checks

set -e

echo "🚀 Production Database Migration Script"
echo "======================================="
echo ""

# Set working directory to API workspace
SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR" || exit 1

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Production Migration Commands:"
    echo "  pre-check      - Validate environment and database connectivity"
    echo "  backup         - Create database backup before migration"
    echo "  deploy         - Deploy migrations to production (with validations)"
    echo "  verify         - Verify migration success and data integrity"
    echo "  rollback       - Rollback instructions and procedures"
    echo "  seed-prod      - Seed production database (admin user only)"
    echo "  health-check   - Comprehensive database health check"
    echo "  monitor        - Database monitoring and performance check"
    echo ""
    echo "Development Commands:"
    echo "  generate       - Generate Prisma client"
    echo "  studio         - Open Prisma Studio"
    echo "  status         - Check migration status"
    echo ""
}

check_environment() {
    echo -e "${BLUE}🔍 Environment Pre-checks${NC}"
    echo "-------------------------"
    
    # Check required environment variables
    if [[ -z "$DATABASE_URL" ]]; then
        echo -e "${RED}❌ DATABASE_URL is not set${NC}"
        exit 1
    fi
    
    # Validate NODE_ENV
    if [[ "$NODE_ENV" != "production" ]]; then
        echo -e "${YELLOW}⚠️  NODE_ENV is not set to 'production'${NC}"
        read -p "Continue anyway? (y/N): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            exit 1
        fi
    fi
    
    # Check if DATABASE_URL looks like production
    if [[ "$DATABASE_URL" == *"localhost"* ]] || [[ "$DATABASE_URL" == *"127.0.0.1"* ]]; then
        echo -e "${RED}❌ DATABASE_URL appears to point to localhost - this should not be used in production${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment variables validated${NC}"
}

test_connectivity() {
    echo -e "${BLUE}🔌 Database Connectivity Test${NC}"
    echo "-----------------------------"
    
    # Test basic connectivity
    if npx prisma db pull --schema=prisma/schema.prisma >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        echo "Please check your DATABASE_URL and network connectivity"
        exit 1
    fi
}

create_backup() {
    echo -e "${BLUE}💾 Creating Database Backup${NC}"
    echo "---------------------------"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_${TIMESTAMP}.sql"
    
    echo "Creating backup: $BACKUP_FILE"
    
    # This is a placeholder - actual backup command depends on your database provider
    echo -e "${YELLOW}📝 Manual Backup Required:${NC}"
    echo ""
    echo "For Vercel Postgres:"
    echo "  vercel postgres dump --schema=public > $BACKUP_FILE"
    echo ""
    echo "For other providers, use your provider's backup tools:"
    echo "  - AWS RDS: Create snapshot"
    echo "  - Neon: Use Neon dashboard or API"
    echo "  - Google Cloud SQL: Create backup"
    echo ""
    
    read -p "Have you created a backup? (y/N): " backup_confirm
    if [[ "$backup_confirm" != "y" && "$backup_confirm" != "Y" ]]; then
        echo -e "${RED}❌ Backup required before proceeding${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Backup confirmed${NC}"
}

deploy_migrations() {
    echo -e "${BLUE}🚀 Deploying Database Migrations${NC}"
    echo "--------------------------------"
    
    echo "Checking migration status..."
    npx prisma migrate status
    
    echo ""
    echo "Applying migrations..."
    npx prisma migrate deploy
    
    echo ""
    echo "Generating Prisma client..."
    npx prisma generate
    
    echo -e "${GREEN}✅ Migrations deployed successfully${NC}"
}

verify_deployment() {
    echo -e "${BLUE}✅ Verifying Migration Success${NC}"
    echo "------------------------------"
    
    # Check if tables exist
    echo "Verifying table structure..."
    
    # Test basic queries
    echo "Testing database connectivity..."
    npx tsx -e "
    import { PrismaClient } from '@prisma/client';
    const prisma = new PrismaClient();
    
    async function verify() {
        try {
            // Test basic connectivity
            await prisma.\$queryRaw\`SELECT 1\`;
            console.log('✅ Database connectivity: OK');
            
            // Check if users table exists and has expected structure
            const userCount = await prisma.user.count();
            console.log(\`✅ Users table: OK (\${userCount} records)\`);
            
            // Check if audit_logs table exists
            const auditCount = await prisma.auditLog.count();
            console.log(\`✅ Audit logs table: OK (\${auditCount} records)\`);
            
            // Verify admin user exists
            const adminExists = await prisma.user.findFirst({
                where: { roles: { has: 'admin' } }
            });
            
            if (adminExists) {
                console.log('✅ Admin user: OK');
            } else {
                console.log('⚠️  Admin user: Not found');
            }
            
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            process.exit(1);
        } finally {
            await prisma.\$disconnect();
        }
    }
    
    verify();
    "
    
    echo -e "${GREEN}✅ Migration verification completed${NC}"
}

seed_production() {
    echo -e "${BLUE}🌱 Production Database Seeding${NC}"
    echo "------------------------------"
    
    echo -e "${YELLOW}⚠️  This will create/update the admin user${NC}"
    echo "Environment: $NODE_ENV"
    
    read -p "Continue with production seeding? (y/N): " seed_confirm
    if [[ "$seed_confirm" != "y" && "$seed_confirm" != "Y" ]]; then
        echo "Seeding cancelled"
        exit 0
    fi
    
    echo "Running production seed..."
    NODE_ENV=production npx tsx scripts/seed.ts
    
    echo -e "${GREEN}✅ Production seeding completed${NC}"
    echo ""
    echo -e "${YELLOW}📝 Important:${NC}"
    echo "1. Change the admin password after first login"
    echo "2. Review created users and deactivate any unnecessary accounts"
    echo "3. Set up proper backup procedures for your environment"
}

health_check() {
    echo -e "${BLUE}🏥 Database Health Check${NC}"
    echo "-----------------------"
    
    npx tsx -e "
    import { PrismaClient } from '@prisma/client';
    import DatabaseMonitor from '../lib/db-monitoring.js';
    
    const prisma = new PrismaClient();
    
    async function healthCheck() {
        try {
            console.log('🔍 Running comprehensive health check...');
            console.log('');
            
            // Basic connectivity
            const start = Date.now();
            await prisma.\$queryRaw\`SELECT 1\`;
            const latency = Date.now() - start;
            console.log(\`✅ Database latency: \${latency}ms\`);
            
            // Connection pool status
            const poolStatus = await DatabaseMonitor.getConnectionPoolStatus();
            console.log(\`📊 Active connections: \${poolStatus.activeConnections}\`);
            console.log(\`📊 Idle connections: \${poolStatus.idleConnections}\`);
            console.log(\`📊 Total connections: \${poolStatus.totalConnections}\`);
            
            // Database size
            const dbSize = await DatabaseMonitor.getDatabaseSize();
            console.log(\`💾 Database size: \${dbSize}\`);
            
            // Performance test
            console.log('⚡ Running performance test...');
            const perfTest = await DatabaseMonitor.performanceTest();
            console.log(\`  - Simple query: \${perfTest.simpleQuery}ms\`);
            console.log(\`  - Complex query: \${perfTest.complexQuery}ms\`);
            console.log(\`  - Insert test: \${perfTest.insertTest}ms\`);
            
            console.log('');
            console.log('✅ Health check completed successfully');
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            process.exit(1);
        } finally {
            await prisma.\$disconnect();
        }
    }
    
    healthCheck();
    "
}

show_rollback_instructions() {
    echo -e "${RED}🔄 Database Rollback Procedures${NC}"
    echo "==============================="
    echo ""
    echo "⚠️  Database rollbacks should be performed carefully and only when necessary"
    echo ""
    echo -e "${BLUE}1. Identify the migration to rollback:${NC}"
    echo "   ls -la prisma/migrations/"
    echo ""
    echo -e "${BLUE}2. Review the migration SQL:${NC}"
    echo "   cat prisma/migrations/[migration_name]/migration.sql"
    echo ""
    echo -e "${BLUE}3. Create rollback SQL (if not already exists):${NC}"
    echo "   # Manually create the reverse operations"
    echo "   # Example: DROP TABLE becomes CREATE TABLE"
    echo "   #          ADD COLUMN becomes DROP COLUMN"
    echo ""
    echo -e "${BLUE}4. Apply rollback (with backup first!):${NC}"
    echo "   # Create backup first"
    echo "   # Apply your rollback SQL script"
    echo "   # Update _prisma_migrations table"
    echo ""
    echo -e "${BLUE}5. Verify rollback:${NC}"
    echo "   npx prisma migrate status"
    echo "   # Run application tests"
    echo ""
    echo -e "${YELLOW}💡 Prevention Tips:${NC}"
    echo "- Always test migrations in staging first"
    echo "- Keep migrations small and focused"
    echo "- Create rollback scripts when writing migrations"
    echo "- Maintain comprehensive backups"
}

case "$1" in
    pre-check)
        check_environment
        test_connectivity
        echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"
        ;;
    backup)
        check_environment
        create_backup
        ;;
    deploy)
        check_environment
        test_connectivity
        create_backup
        deploy_migrations
        verify_deployment
        echo ""
        echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Run health check: $0 health-check"
        echo "2. Seed database if needed: $0 seed-prod"
        echo "3. Monitor application logs and metrics"
        ;;
    verify)
        check_environment
        verify_deployment
        ;;
    rollback)
        show_rollback_instructions
        ;;
    seed-prod)
        check_environment
        seed_production
        ;;
    health-check)
        check_environment
        health_check
        ;;
    monitor)
        check_environment
        health_check
        echo ""
        echo -e "${BLUE}📊 Additional monitoring available via API:${NC}"
        echo "GET /api/db-monitor?metrics=all&performance=true"
        ;;
    generate)
        echo "🔄 Generating Prisma client..."
        npx prisma generate
        echo -e "${GREEN}✅ Prisma client generated${NC}"
        ;;
    studio)
        echo "🖥️  Opening Prisma Studio..."
        npx prisma studio
        ;;
    status)
        echo "📊 Checking migration status..."
        npx prisma migrate status
        ;;
    *)
        print_usage
        exit 1
        ;;
esac