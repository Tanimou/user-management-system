/**
 * Role validation utilities for user management system
 * Provides functions for validating role assignments and preventing unauthorized operations
 */
/**
 * Role validation function
 * Validates that roles array contains valid roles and includes required 'user' role
 */
export function validateRoles(roles) {
    const validRoles = ['user', 'admin'];
    return roles.every(role => validRoles.includes(role)) &&
        roles.includes('user'); // user role always required
}
/**
 * Self-demotion guard
 * Prevents admin users from removing their own admin role
 */
export function preventSelfDemotion(currentUser, targetUser, newRoles) {
    const currentUserId = currentUser.userId || currentUser.id;
    if (currentUserId === targetUser.id &&
        currentUser.roles.includes('admin') &&
        !newRoles.includes('admin')) {
        throw new Error('Cannot remove your own admin role');
    }
}
/**
 * Self-deactivation guard
 * Prevents admin users from deactivating themselves
 */
export function preventSelfDeactivation(currentUser, targetUser, isActive) {
    const currentUserId = currentUser.userId || currentUser.id;
    if (currentUserId === targetUser.id && !isActive) {
        throw new Error('Cannot deactivate yourself');
    }
}
/**
 * Get available roles with descriptions
 * Returns list of all available roles in the system
 */
export function getAvailableRoles() {
    return [
        {
            value: 'user',
            label: 'User',
            description: 'Default role with read-only access'
        },
        {
            value: 'admin',
            label: 'Admin',
            description: 'Full system administration access'
        }
    ];
}
/**
 * Check if role change requires confirmation
 * Returns true for critical operations that need user confirmation
 */
export function requiresConfirmation(currentRoles, newRoles) {
    // Removing admin role requires confirmation
    if (currentRoles.includes('admin') && !newRoles.includes('admin')) {
        return true;
    }
    // Adding admin role requires confirmation
    if (!currentRoles.includes('admin') && newRoles.includes('admin')) {
        return true;
    }
    return false;
}
/**
 * Get role change description for audit logging
 */
export function getRoleChangeDescription(oldRoles, newRoles) {
    const added = newRoles.filter(role => !oldRoles.includes(role));
    const removed = oldRoles.filter(role => !newRoles.includes(role));
    const changes = [];
    if (added.length > 0) {
        changes.push(`Added: ${added.join(', ')}`);
    }
    if (removed.length > 0) {
        changes.push(`Removed: ${removed.join(', ')}`);
    }
    return changes.join('; ') || 'No changes';
}
