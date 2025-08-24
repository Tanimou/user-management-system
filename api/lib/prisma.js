import { PrismaClient } from '@prisma/client';
const createPrismaClient = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });
};
// Singleton pattern for serverless
export const prisma = global.__prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}
// Connection pool monitoring and testing
export async function testDatabaseConnection() {
    try {
        await prisma.$queryRaw `SELECT 1`;
        return {
            status: 'connected',
            timestamp: new Date().toISOString(),
            latency: Date.now() // Basic latency measurement
        };
    }
    catch (error) {
        console.error('Database connection failed:', error);
        return {
            status: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
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
};
// Select object for authentication that includes password
export const USER_AUTH_SELECT_FIELDS = {
    ...USER_SELECT_FIELDS,
    password: true,
};
export default prisma;
