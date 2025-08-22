// scripts/migrate-production.ts
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function migrateProduction() {
  console.log('Starting production database migration...');
  
  try {
    // Apply pending migrations
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    
    // Create admin user if none exists
    const adminExists = await prisma.user.findFirst({
      where: { roles: { has: 'admin' } }
    });
    
    if (!adminExists) {
      const hashedPassword = await argon2.hash('Admin123!');
      await prisma.user.create({
        data: {
          name: 'System Administrator',
          email: 'admin@company.com',
          password: hashedPassword,
          roles: ['user', 'admin'],
          isActive: true
        }
      });
      console.log('Default admin user created');
    }
    
    console.log('Production migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateProduction();