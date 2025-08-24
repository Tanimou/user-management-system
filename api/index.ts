import type { VercelRequest, VercelResponse } from '@vercel/node';

// All imports commented out to isolate the issue
// import testHandler from '../lib/routes/test.js'; // Simple test handler
// import meHandler from '../lib/routes/me.js'; // Temporarily commented out to isolate issue
// import performanceHandler from '../lib/routes/performance.js'; // Temporarily commented out to isolate issue
// import refreshHandler from '../lib/routes/refresh.js'; // Temporarily commented out to isolate issue
// import rolesHandler from '../lib/routes/roles.js'; // Temporarily commented out to isolate issue
// import uploadAvatarHandler from '../lib/routes/upload-avatar.js'; // Temporarily commented out to isolate issue
// import usersIdHandler from '../lib/routes/users/[id].js'; // Temporarily commented out to isolate issue
// import usersDeactivatedHandler from '../lib/routes/users/deactivated.js'; // Temporarily commented out to isolate issue
// import usersIndexHandler from '../lib/routes/users/index.js'; // Temporarily commented out to isolate issue
// import validatePasswordHandler from '../lib/routes/validate-password.js'; // Temporarily commented out to isolate issue

/**
 * Main API router - routes all /api/* requests to appropriate handlers
 * This consolidates all endpoints into a single serverless function for Vercel
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Extract path from URL, removing the /api prefix
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    
    console.log(`[Router] ${req.method} ${path}`);

    // Route to appropriate handlers based on path
    switch (path) {
      case '/test':
        return res.status(200).json({ 
          message: 'Inline test endpoint working',
          timestamp: new Date().toISOString() 
        });
        // return await testHandler(req, res);
        
      case '/health':
        return res.status(503).json({ error: 'Health endpoint skipped per user request' });
        // return await healthHandler(req, res);
        
      case '/login':
        // Inline login logic to test without import dependencies
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          return res.status(200).end();
        }

        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const { email, password } = req.body || {};
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // For now, just test with hardcoded admin credentials
        if (email === 'admin@example.com' && password === 'AdminSecure2024!@#') {
          return res.status(200).json({
            message: 'Login successful (test mode)',
            token: 'test-token',
            user: {
              id: 1,
              email: 'admin@example.com',
              name: 'Admin User',
              roles: ['admin', 'user']
            }
          });
        }
        
        return res.status(401).json({ error: 'Invalid credentials' });
        // return await loginHandler(req, res);
        
      case '/me':
        // Inline user profile handler
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          return res.status(200).end();
        }

        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        // Mock user profile based on token
        return res.status(200).json({
          id: 1,
          name: 'Admin User',
          email: 'admin@example.com',
          roles: ['admin', 'user'],
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        });
        // return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await meHandler(req as any, res);
        
      case '/refresh':
        // Inline refresh token handler
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          return res.status(200).end();
        }

        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        // Mock refresh token logic
        return res.status(200).json({
          token: 'refreshed-test-token',
          message: 'Token refreshed successfully'
        });
        // return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await refreshHandler(req, res);
        
      case '/roles':
        return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await rolesHandler(req, res);
        
      case '/upload-avatar':
        return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await uploadAvatarHandler(req as any, res);
        
      case '/validate-password':
        return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await validatePasswordHandler(req, res);
        
      case '/db-monitor':
        // Temporarily disabled due to circular import issue
        return res.status(503).json({ error: 'DB monitor temporarily unavailable' });
        // return await dbMonitorHandler(req, res);
        
      case '/performance':
        return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await performanceHandler(req, res);
        
      case '/users':
        // Inline users list handler
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          return res.status(200).end();
        }

        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        // Mock users data for testing
        const mockUsers = [
          {
            id: 1,
            name: 'Admin User',
            email: 'admin@example.com',
            roles: ['admin', 'user'],
            isActive: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          },
          {
            id: 2,
            name: 'Regular User',
            email: 'user@example.com',
            roles: ['user'],
            isActive: true,
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z'
          }
        ];

        const { page = 1, size = 10 } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const pageSize = Math.min(parseInt(size as string) || 10, 50);

        return res.status(200).json({
          items: mockUsers,
          page: pageNum,
          size: pageSize,
          total: mockUsers.length,
          totalPages: Math.ceil(mockUsers.length / pageSize)
        });
        // return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await usersIndexHandler(req as any, res);
        
      case '/users/deactivated':
        return res.status(503).json({ error: 'Temporarily unavailable' });
        // return await usersDeactivatedHandler(req as any, res);
        
      default:
        // Handle dynamic user ID routes like /users/123
        const userIdMatch = path.match(/^\/users\/(\d+)$/);
        if (userIdMatch) {
          return res.status(503).json({ error: 'Temporarily unavailable' });
          // Set the ID in query params for the handler
          // req.query = { ...req.query, id: userIdMatch[1] };
          // return await usersIdHandler(req as any, res);
        }
        
        // If no route matches, return 404
        return res.status(404).json({
          error: 'Not Found',
          message: `The endpoint ${path} does not exist`
        });
    }
  } catch (error) {
    console.error('[Router] Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while routing the request'
    });
  }
}