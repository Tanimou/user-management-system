// Example implementation showing middleware composition
import type { VercelResponse } from '@vercel/node';
import { 
  withAuth, 
  withAdminRole, 
  withCORS, 
  withErrorHandling,
  validateQuery,
  type AuthenticatedRequest 
} from '../middleware/auth.js';
import { getUsersSchema } from '../schemas/user.js';
import { prisma } from '../prisma.js';

// Example of middleware composition following the issue requirements
const getUsersHandler = withCORS(
  withErrorHandling(
    withAuth(
      withAdminRole(
        validateQuery(getUsersSchema)(
          async (req: AuthenticatedRequest, res: VercelResponse) => {
            const { page, size, search, active, sort, order } = req.query as any;

            const skip = (page - 1) * size;
            const where: any = {};

            // Apply filters
            if (search) {
              where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
              ];
            }

            if (active !== undefined) {
              where.isActive = active;
            }

            // Get total count
            const total = await prisma.user.count({ where });

            // Get users with pagination and sorting
            const users = await prisma.user.findMany({
              where,
              skip,
              take: size,
              orderBy: { [sort]: order },
              select: {
                id: true,
                name: true,
                email: true,
                roles: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
              }
            });

            return res.status(200).json({
              users,
              pagination: {
                page,
                size,
                total,
                totalPages: Math.ceil(total / size)
              }
            });
          }
        )
      )
    )
  )
);

export default getUsersHandler;