import { describe, it, expect } from 'vitest';
import { 
  validateRoles, 
  preventSelfDemotion, 
  preventSelfDeactivation, 
  getAvailableRoles, 
  requiresConfirmation, 
  getRoleChangeDescription 
} from '../lib/role-validation';

describe('Role Validation Functions', () => {
  describe('validateRoles', () => {
    it('should return true for valid roles including user', () => {
      expect(validateRoles(['user'])).toBe(true);
      expect(validateRoles(['user', 'admin'])).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(validateRoles(['admin'])).toBe(false); // missing user
      expect(validateRoles(['user', 'invalid'])).toBe(false);
      expect(validateRoles(['invalid'])).toBe(false);
      expect(validateRoles([])).toBe(false);
    });
  });

  describe('preventSelfDemotion', () => {
    it('should throw error when admin removes own admin role', () => {
      const currentUser = { userId: 1, roles: ['admin'] };
      const targetUser = { id: 1, roles: ['user', 'admin'] };
      const newRoles = ['user'];

      expect(() => {
        preventSelfDemotion(currentUser, targetUser, newRoles);
      }).toThrow('Cannot remove your own admin role');
    });

    it('should not throw when admin removes admin from other user', () => {
      const currentUser = { userId: 1, roles: ['admin'] };
      const targetUser = { id: 2, roles: ['user', 'admin'] };
      const newRoles = ['user'];

      expect(() => {
        preventSelfDemotion(currentUser, targetUser, newRoles);
      }).not.toThrow();
    });

    it('should not throw when admin keeps admin role', () => {
      const currentUser = { userId: 1, roles: ['admin'] };
      const targetUser = { id: 1, roles: ['user', 'admin'] };
      const newRoles = ['user', 'admin'];

      expect(() => {
        preventSelfDemotion(currentUser, targetUser, newRoles);
      }).not.toThrow();
    });
  });

  describe('preventSelfDeactivation', () => {
    it('should throw error when user deactivates themselves', () => {
      const currentUser = { userId: 1 };
      const targetUser = { id: 1 };

      expect(() => {
        preventSelfDeactivation(currentUser, targetUser, false);
      }).toThrow('Cannot deactivate yourself');
    });

    it('should not throw when user deactivates another user', () => {
      const currentUser = { userId: 1 };
      const targetUser = { id: 2 };

      expect(() => {
        preventSelfDeactivation(currentUser, targetUser, false);
      }).not.toThrow();
    });

    it('should not throw when user activates themselves', () => {
      const currentUser = { userId: 1 };
      const targetUser = { id: 1 };

      expect(() => {
        preventSelfDeactivation(currentUser, targetUser, true);
      }).not.toThrow();
    });
  });

  describe('getAvailableRoles', () => {
    it('should return expected roles with descriptions', () => {
      const roles = getAvailableRoles();
      
      expect(roles).toHaveLength(2);
      expect(roles).toContainEqual({
        value: 'user',
        label: 'User',
        description: 'Default role with read-only access'
      });
      expect(roles).toContainEqual({
        value: 'admin',
        label: 'Admin', 
        description: 'Full system administration access'
      });
    });
  });

  describe('requiresConfirmation', () => {
    it('should return true when removing admin role', () => {
      expect(requiresConfirmation(['user', 'admin'], ['user'])).toBe(true);
    });

    it('should return true when adding admin role', () => {
      expect(requiresConfirmation(['user'], ['user', 'admin'])).toBe(true);
    });

    it('should return false for non-admin role changes', () => {
      expect(requiresConfirmation(['user'], ['user'])).toBe(false);
    });
  });

  describe('getRoleChangeDescription', () => {
    it('should describe role additions', () => {
      const description = getRoleChangeDescription(['user'], ['user', 'admin']);
      expect(description).toBe('Added: admin');
    });

    it('should describe role removals', () => {
      const description = getRoleChangeDescription(['user', 'admin'], ['user']);
      expect(description).toBe('Removed: admin');
    });

    it('should describe both additions and removals', () => {
      const description = getRoleChangeDescription(['admin'], ['user', 'admin']);
      expect(description).toBe('Added: user');
    });

    it('should handle no changes', () => {
      const description = getRoleChangeDescription(['user'], ['user']);
      expect(description).toBe('No changes');
    });
  });
});