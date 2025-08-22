/**
 * Roles API endpoint
 * GET /api/roles - List available roles and their permissions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders, requireAuth, type AuthenticatedRequest } from './lib/auth.js';
import { getAvailableRoles } from './lib/role-validation.js';

/**
 * Authorization matrix for different resources
 */
const authorizationMatrix = {
  'own_profile': {
    'user': ['view', 'edit_name', 'edit_password'],
    'admin': ['view', 'edit_name', 'edit_password']
  },
  'all_users': {
    'user': [],
    'admin': ['view']
  },
  'user_roles': {
    'user': [],
    'admin': ['view', 'modify']
  },
  'user_management': {
    'user': [],
    'admin': ['create', 'edit', 'delete', 'activate', 'deactivate']
  }
};

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user - only authenticated users can view roles
  const isAuthenticated = await requireAuth(req, res);
  if (!isAuthenticated) return;

  try {
    const roles = getAvailableRoles();
    
    // Add permission information to roles
    const rolesWithPermissions = roles.map(role => ({
      ...role,
      permissions: getPermissionsForRole(role.value)
    }));

    return res.status(200).json({ 
      data: {
        roles: rolesWithPermissions,
        authorizationMatrix,
        meta: {
          totalRoles: roles.length,
          description: 'Available roles in the user management system'
        }
      }
    });
  } catch (error) {
    console.error('Get roles error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get permissions for a specific role
 */
function getPermissionsForRole(roleName: string): string[] {
  const permissions: Record<string, string[]> = {
    'user': [
      'view_own_profile',
      'edit_own_name', 
      'edit_own_password'
    ],
    'admin': [
      'view_own_profile',
      'edit_own_name',
      'edit_own_password',
      'view_all_users',
      'create_users',
      'edit_user_details',
      'manage_user_roles',
      'activate_deactivate_users',
      'soft_delete_users'
    ]
  };

  return permissions[roleName] || [];
}