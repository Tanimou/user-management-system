import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Singleton pattern for serverless
export const prisma = global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Shared select object for user fields to reduce duplication
export const USER_SELECT_FIELDS = {
  id: true,
  name: true,
  email: true,
  roles: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  avatarUrl: true,
} as const;

// Select object for authentication that includes password
export const USER_AUTH_SELECT_FIELDS = {
  ...USER_SELECT_FIELDS,
  password: true,
} as const;

export default prisma;