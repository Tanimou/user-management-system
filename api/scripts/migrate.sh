#!/bin/bash

# Migration Commands Reference
# This script provides all the common migration commands for the user management system

echo "🗄️  Database Migration Commands for User Management System"
echo "=========================================================="
echo ""

# Set working directory to API workspace
cd "$(dirname "$0")" || exit 1

print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Available commands:"
    echo "  init           - Generate initial migration from schema"
    echo "  generate       - Generate Prisma client"
    echo "  deploy         - Deploy migrations to production"
    echo "  reset          - Reset database (development only)"
    echo "  rollback       - Manual rollback instructions"
    echo "  seed           - Run seed data script"
    echo "  studio         - Open Prisma Studio"
    echo "  status         - Check migration status"
    echo ""
}

case "$1" in
    init)
        echo "📝 Generating initial migration..."
        npx prisma migrate dev --name init --create-only
        echo "✅ Migration generated successfully!"
        echo "💡 Review the migration in prisma/migrations/ before applying"
        ;;
    generate)
        echo "🔄 Generating Prisma client..."
        npx prisma generate
        echo "✅ Prisma client generated successfully!"
        ;;
    deploy)
        echo "🚀 Deploying migrations to production..."
        npx prisma migrate deploy
        echo "✅ Migrations deployed successfully!"
        ;;
    reset)
        echo "⚠️  Resetting database (development only)..."
        read -p "Are you sure? This will delete ALL data. Type 'yes' to continue: " confirm
        if [ "$confirm" = "yes" ]; then
            npx prisma migrate reset --force
            echo "✅ Database reset completed!"
        else
            echo "❌ Database reset cancelled"
        fi
        ;;
    rollback)
        echo "🔄 Manual Rollback Instructions"
        echo "================================"
        echo ""
        echo "To rollback the latest migration:"
        echo "1. Identify the migration to rollback:"
        echo "   ls -la prisma/migrations/"
        echo ""
        echo "2. Apply the rollback SQL script:"
        echo "   psql \$DATABASE_URL -f prisma/migrations/[migration_name]/rollback.sql"
        echo ""
        echo "3. Update the migration history:"
        echo "   DELETE FROM _prisma_migrations WHERE migration_name = '[migration_name]';"
        echo ""
        echo "⚠️  Always backup your database before rolling back!"
        ;;
    seed)
        echo "🌱 Running database seed script..."
        npx tsx scripts/seed.ts
        echo "✅ Database seeded successfully!"
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