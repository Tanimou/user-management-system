import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore, type User } from '../auth';
import apiClient from '../../api/axios';

// Mock the API client
vi.mock('../../api/axios');

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test helper function to create a mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  roles: ['user'],
  isActive: true,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  ...overrides
});

describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('should restore token from localStorage on initialization', async () => {
      localStorageMock.getItem.mockReturnValue('stored-token');
      
      // Create a new store instance and call initialize
      setActivePinia(createPinia());
      const newStore = useAuthStore();
      await newStore.initialize();
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_token');
      expect(newStore.token).toBe('stored-token');
    });
  });

  describe('Login Functionality', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          token: 'jwt-token-123',
          user: createMockUser()
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await authStore.login(loginData);

      expect(apiClient.post).toHaveBeenCalledWith('/login', loginData);
      expect(authStore.token).toBe('jwt-token-123');
      expect(authStore.user).toEqual(createMockUser());
      expect(authStore.isAuthenticated).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle login failure with invalid credentials', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid email or password'
          }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(authStore.login(loginData)).rejects.toThrow('Invalid email or password');
      
      expect(authStore.error).toBe('Invalid email or password');
      expect(authStore.token).toBeNull();
      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('should handle network errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network Error'));

      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      await expect(authStore.login(loginData)).rejects.toThrow('Network Error');
      
      expect(authStore.error).toBe('Network Error');
      expect(authStore.isAuthenticated).toBe(false);
    });
  });

  describe('Logout Functionality', () => {
    it('should logout successfully', async () => {
      // Set up authenticated state
      authStore.user = createMockUser();
      authStore.token = 'test-token';

      vi.mocked(apiClient.post).mockResolvedValue({});

      await authStore.logout();

      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(apiClient.post).toHaveBeenCalledWith('/logout');
    });

    it('should clear local state even if logout API fails', async () => {
      // Set up authenticated state
      authStore.user = createMockUser();
      authStore.token = 'test-token';

      vi.mocked(apiClient.post).mockRejectedValue(new Error('API Error'));

      await authStore.logout();

      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('Profile Functionality', () => {
    it('should fetch user profile', async () => {
      const mockUser = createMockUser();
      const mockResponse = { data: { user: mockUser } };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await authStore.fetchProfile();

      expect(apiClient.get).toHaveBeenCalledWith('/me');
      expect(authStore.user).toEqual(mockUser);
      expect(result).toEqual(mockUser);
    });

    it('should update user profile', async () => {
      const mockUser = createMockUser({ name: 'Updated Name' });
      const mockResponse = { data: { user: mockUser } };

      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      const updateData = { name: 'Updated Name' };
      const result = await authStore.updateProfile(updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/me', updateData);
      expect(authStore.user).toEqual(mockUser);
      expect(result).toEqual(mockUser);
    });

    it('should handle profile update errors', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Update failed'
          }
        }
      };

      vi.mocked(apiClient.put).mockRejectedValue(mockError);

      const updateData = { name: 'Updated Name' };

      await expect(authStore.updateProfile(updateData)).rejects.toThrow('Update failed');
      expect(authStore.error).toBe('Update failed');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        data: {
          token: 'new-jwt-token-456'
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      authStore.token = 'old-token';

      const result = await authStore.refreshToken();

      expect(apiClient.post).toHaveBeenCalledWith('/refresh');
      expect(authStore.token).toBe('new-jwt-token-456');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-jwt-token-456');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle refresh failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Refresh failed'));

      await expect(authStore.refreshToken()).rejects.toThrow('Refresh failed');

      // Should logout user on refresh failure
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('Computed Properties', () => {
    it('should correctly compute isAuthenticated', () => {
      expect(authStore.isAuthenticated).toBe(false);

      authStore.token = 'test-token';
      expect(authStore.isAuthenticated).toBe(false); // Still false without user

      authStore.user = createMockUser();
      expect(authStore.isAuthenticated).toBe(true); // True with both token and user
    });

    it('should correctly compute isAdmin', () => {
      expect(authStore.isAdmin).toBe(false);

      authStore.user = createMockUser({ roles: ['user'] });
      expect(authStore.isAdmin).toBe(false);

      authStore.user = createMockUser({ roles: ['admin', 'user'] });
      expect(authStore.isAdmin).toBe(true);
    });

    it('should correctly check roles', () => {
      expect(authStore.hasRole('admin')).toBe(false);

      authStore.user = createMockUser({ roles: ['user'] });
      expect(authStore.hasRole('user')).toBe(true);
      expect(authStore.hasRole('admin')).toBe(false);

      authStore.user = createMockUser({ roles: ['admin', 'user'] });
      expect(authStore.hasRole('admin')).toBe(true);
      expect(authStore.hasRole('user')).toBe(true);
    });
  });

  describe('User Management', () => {
    it('should update user data', () => {
      authStore.user = createMockUser();

      authStore.updateUser({ name: 'Updated Name' });

      expect(authStore.user?.name).toBe('Updated Name');
    });

    it('should set demo user', () => {
      const demoUser = createMockUser({ name: 'Demo User', email: 'demo@example.com' });

      authStore.setDemoUser(demoUser);

      expect(authStore.user).toEqual(demoUser);
      expect(authStore.token).toBe('demo-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'demo-token');
    });
  });

  describe('Error Handling', () => {
    it('should clear errors', () => {
      authStore.setError('Test error');
      expect(authStore.error).toBe('Test error');

      authStore.clearError();
      expect(authStore.error).toBeNull();
    });

    it('should set errors', () => {
      authStore.setError('New error');
      expect(authStore.error).toBe('New error');
    });
  });

  describe('Persistence', () => {
    it('should initialize from localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('persisted-token');
      
      setActivePinia(createPinia());
      const newStore = useAuthStore();
      await newStore.initialize();
      
      expect(newStore.token).toBe('persisted-token');
    });

    it('should save token to localStorage on login', async () => {
      const mockResponse = {
        data: {
          token: 'login-token-789',
          user: createMockUser()
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      await authStore.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'login-token-789');
    });

    it('should remove token from localStorage on logout', async () => {
      authStore.user = createMockUser();
      authStore.token = 'test-token';

      vi.mocked(apiClient.post).mockResolvedValue({});

      await authStore.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('API Error Handling', () => {
    it('should handle 500 server errors', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Internal server error'
          }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(authStore.login({
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow();

      expect(authStore.error).toBe('Internal server error');
    });
  });
});