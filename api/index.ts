import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import all handlers from the lib/routes directory
import healthHandler from './lib/routes/health.js';
import loginHandler from './lib/routes/login.js';
import meHandler from './lib/routes/me.js';
import refreshHandler from './lib/routes/refresh.js';
import rolesHandler from './lib/routes/roles.js';
import uploadAvatarHandler from './lib/routes/upload-avatar.js';
import validatePasswordHandler from './lib/routes/validate-password.js';
import dbMonitorHandler from './lib/routes/db-monitor.js';
import performanceHandler from './lib/routes/performance.js';
import usersIndexHandler from './lib/routes/users/index.js';
import usersIdHandler from './lib/routes/users/[id].js';
import usersDeactivatedHandler from './lib/routes/users/deactivated.js';
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
      case '/health':
        return await healthHandler(req, res);
        
      case '/login':
        return await loginHandler(req, res);
        
      case '/me':
        return await meHandler(req as any, res);
        
      case '/refresh':
        return await refreshHandler(req, res);
        
      case '/roles':
        return await rolesHandler(req, res);
        
      case '/upload-avatar':
        return await uploadAvatarHandler(req as any, res);
        
      case '/validate-password':
        return await validatePasswordHandler(req, res);
        
      case '/db-monitor':
        return await dbMonitorHandler(req, res);
        
      case '/performance':
        return await performanceHandler(req, res);
        
      case '/users':
        return await usersIndexHandler(req as any, res);
        
      case '/users/deactivated':
        return await usersDeactivatedHandler(req as any, res);
        
      default:
        // Handle dynamic user ID routes like /users/123
        const userIdMatch = path.match(/^\/users\/(\d+)$/);
        if (userIdMatch) {
          // Set the ID in query params for the handler
          req.query = { ...req.query, id: userIdMatch[1] };
          return await usersIdHandler(req as any, res);
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