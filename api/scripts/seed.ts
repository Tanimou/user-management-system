import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  const isProduction = process.env.NODE_ENV === 'production';

  // Enhanced argon2 configuration for production
  const argon2Config = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  };

  // Create admin user - always create/update in all environments
  console.log('👤 Creating/updating admin user...');
  
  // In production, use a stronger default password or require it via env var
  let adminPassword = 'password123';
  if (isProduction) {
    adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPassword123!';
    if (adminPassword === 'AdminPassword123!') {
      console.warn('⚠️  WARNING: Using default admin password in production. Please change immediately after deployment!');
    }
  }

  const adminPasswordHash = await argon2.hash(adminPassword, argon2Config);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      // In production, only update if specifically requested
      ...(process.env.UPDATE_ADMIN === 'true' ? { password: adminPasswordHash } : {})
    },
    create: {
      name: 'System Administrator',
      email: 'admin@example.com',
      password: adminPasswordHash,
      roles: ['user', 'admin'],
      isActive: true,
    },
  });

  console.log(`✅ Admin user: ${admin.name} (${admin.email})`);

  // Skip sample users in production unless explicitly requested
  if (!isProduction || process.env.CREATE_SAMPLE_USERS === 'true') {
    console.log('👥 Creating sample users...');
    
    const userPassword = await argon2.hash('password123', argon2Config);

    // Create regular user
    const user = await prisma.user.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        name: 'John Doe',
        email: 'user@example.com',
        password: userPassword,
        roles: ['user'],
        isActive: true,
      },
    });

    // Create additional sample users (only in development or when explicitly requested)
    const sampleUsers = [
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: userPassword,
        roles: ['user'],
        isActive: true,
      },
      {
        name: 'Mike Johnson',
        email: 'mike@example.com',
        password: userPassword,
        roles: ['user'],
        isActive: true,
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        password: userPassword,
        roles: ['user'],
        isActive: false, // Inactive user for testing
      },
    ];

    for (const userData of sampleUsers) {
      await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: userData,
      });
    }

    console.log(`✅ Sample users: ${1 + sampleUsers.length} created/updated`);
  } else {
    console.log('ℹ️  Skipping sample users in production (set CREATE_SAMPLE_USERS=true to override)');
  }

  // Create initial audit log entry
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'DATABASE_SEED',
      entity: 'System',
      payload: {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        seedVersion: '1.0.0'
      }
    }
  });

  console.log('📊 Database statistics:');
  const userCount = await prisma.user.count();
  const activeUserCount = await prisma.user.count({ where: { isActive: true } });
  const auditLogCount = await prisma.auditLog.count();
  
  console.log(`  - Total users: ${userCount}`);
  console.log(`  - Active users: ${activeUserCount}`);
  console.log(`  - Audit log entries: ${auditLogCount}`);

  console.log('✅ Database seeded successfully!');
  
  if (!isProduction) {
    console.log('');
    console.log('🔐 Test credentials:');
    console.log('📧 Admin: admin@example.com / password123');
    console.log('👤 User: user@example.com / password123');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });