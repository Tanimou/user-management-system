import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash passwords
  const adminPassword = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  const userPassword = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@example.com',
      password: adminPassword,
      roles: ['user', 'admin'],
      isActive: true,
    },
  });

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

  // Create a few more sample users
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

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('🔐 Test credentials:');
  console.log('📧 Admin: admin@example.com / password123');
  console.log('👤 User: user@example.com / password123');
  console.log('');
  console.log(`Created users:`);
  console.log(`- Admin: ${admin.name} (${admin.email})`);
  console.log(`- User: ${user.name} (${user.email})`);
  console.log(`- Sample users: ${sampleUsers.length} additional users`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });