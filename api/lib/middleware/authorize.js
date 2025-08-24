export function withRoles(roles) {
    return function (handler) {
        return async (req, res) => {
            const userRoles = req.user.roles;
            const hasRequiredRole = roles.some(role => userRoles.includes(role));
            if (!hasRequiredRole) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: `Required roles: ${roles.join(', ')}`,
                    userRoles: userRoles
                });
            }
            return handler(req, res);
        };
    };
}
export function withAdminRole(handler) {
    return withRoles(['admin'])(handler);
}
export function withSelfOrAdmin(getUserId) {
    return function (handler) {
        return async (req, res) => {
            const targetUserId = Number(getUserId(req));
            const currentUserId = req.user.id;
            const isAdmin = req.user.roles.includes('admin');
            if (!isAdmin && currentUserId !== targetUserId) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only access your own resources'
                });
            }
            return handler(req, res);
        };
    };
}
// Prevent admin self-demotion
export function preventSelfDemotion(handler) {
    return async (req, res) => {
        const targetUserId = Number(req.query.id || req.body.id);
        const currentUserId = req.user.id;
        const isCurrentUserAdmin = req.user.roles.includes('admin');
        // Check if admin is trying to remove their own admin role
        if (isCurrentUserAdmin && currentUserId === targetUserId) {
            const newRoles = req.body.roles;
            if (newRoles && !newRoles.includes('admin')) {
                return res.status(400).json({
                    error: 'Self-demotion prevented',
                    message: 'Administrators cannot remove their own admin privileges'
                });
            }
            // Check if admin is trying to deactivate themselves
            if (req.body.hasOwnProperty('isActive') && !req.body.isActive) {
                return res.status(400).json({
                    error: 'Self-deactivation prevented',
                    message: 'Administrators cannot deactivate their own account'
                });
            }
        }
        return handler(req, res);
    };
}
