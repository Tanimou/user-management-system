import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';
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

describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    vi.clearAllMocks();
    // Clear any localStorage mocks to prevent state leakage between tests
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.isLoading).toBe(false);
      expect(authStore.error).toBeNull();
    });

    it('should restore token from localStorage on initialization', () => {
      localStorageMock.getItem.mockReturnValue('stored-token');
      
      // Create a new store instance to trigger initialization
      setActivePinia(createPinia());
      const newStore = useAuthStore();
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_token');
      expect(newStore.token).toBe('stored-token');
    });
  });

  describe('Login Functionality', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          success: true,
          token: 'jwt-token-123',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          }
        }
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      await authStore.login(loginData);

      expect(apiClient.post).toHaveBeenCalledWith('/login', loginData);
      expect(authStore.user).toEqual(mockResponse.data.user);
      expect(authStore.token).toBe('jwt-token-123');
      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.error).toBeNull();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
    });

    it('should handle login failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(authStore.login(loginData)).rejects.toThrow();

      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.error).toBe('Invalid credentials');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should show loading state during login', async () => {
      vi.mocked(apiClient.post).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );

      const loginPromise = authStore.login({
        email: 'test@example.com',
        password: 'password123'
      });

      // Check loading state
      expect(authStore.isLoading).toBe(true);

      await loginPromise;

      expect(authStore.isLoading).toBe(false);
    });

    it('should handle network errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network Error'));

      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      await expect(authStore.login(loginData)).rejects.toThrow('Network Error');
      
      expect(authStore.error).toBe('Network error occurred');
      expect(authStore.isAuthenticated).toBe(false);
    });
  });

  describe('Logout Functionality', () => {
    it('should logout successfully', async () => {
      // Set up authenticated state
      authStore.user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        roles: ['user'],
        isActive: true,
      };
      authStore.token = 'jwt-token-123';

      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

      await authStore.logout();

      expect(apiClient.post).toHaveBeenCalledWith('/logout');
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.error).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should clear state even if logout API call fails', async () => {
      // Set up authenticated state
      authStore.user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        roles: ['user'],
        isActive: true,
      };
      authStore.token = 'jwt-token-123';

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Logout failed'));

      await authStore.logout();

      // Should still clear local state
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          token: 'new-jwt-token-456'
        }
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      await authStore.refreshToken();

      expect(apiClient.post).toHaveBeenCalledWith('/refresh');
      expect(authStore.token).toBe('new-jwt-token-456');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-jwt-token-456');
    });

    it('should handle refresh failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Refresh failed'));

      await authStore.refreshToken();

      // Should logout user on refresh failure
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('User Profile Management', () => {
    it('should fetch user profile', async () => {
      const mockUserProfile = {
        data: {
          success: true,
          user: {
            id: 1,
            name: 'Updated User',
            email: 'updated@example.com',
            roles: ['user'],
            isActive: true,
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockUserProfile);

      await authStore.fetchProfile();

      expect(apiClient.get).toHaveBeenCalledWith('/me');
      expect(authStore.user).toEqual(mockUserProfile.data.user);
    });

    it('should update user profile', async () => {
      // Set initial user
      authStore.user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        roles: ['user'],
        isActive: true,
      };

      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const mockResponse = {
        data: {
          success: true,
          user: {
            ...authStore.user,
            ...updateData
          }
        }
      };

      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      await authStore.updateProfile(updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/me', updateData);
      expect(authStore.user?.name).toBe('Updated Name');
      expect(authStore.user?.email).toBe('updated@example.com');
    });
  });

  describe('Error Management', () => {
    it('should clear errors', () => {
      authStore.error = 'Some error';
      
      authStore.clearError();
      
      expect(authStore.error).toBeNull();
    });

    it('should set error messages', () => {
      authStore.setError('New error message');
      
      expect(authStore.error).toBe('New error message');
    });
  });

  describe('Computed Properties', () => {
    it('should correctly compute isAuthenticated', () => {
      expect(authStore.isAuthenticated).toBe(false);
      
      authStore.token = 'some-token';
      authStore.user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        roles: ['user'],
        isActive: true,
      };
      
      expect(authStore.isAuthenticated).toBe(true);
    });

    it('should correctly compute user roles', () => {
      expect(authStore.hasRole('admin')).toBe(false);
      
      authStore.user = {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        roles: ['user', 'admin'],
        isActive: true,
      };
      
      expect(authStore.hasRole('admin')).toBe(true);
      expect(authStore.hasRole('user')).toBe(true);
      expect(authStore.hasRole('moderator')).toBe(false);
    });

    it('should check if user is admin', () => {
      expect(authStore.isAdmin).toBe(false);
      
      authStore.user = {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        roles: ['user', 'admin'],
        isActive: true,
      };
      
      expect(authStore.isAdmin).toBe(true);
    });
  });

  describe('Persistence', () => {
    it('should initialize from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('persisted-token');
      
      setActivePinia(createPinia());
      const newStore = useAuthStore();
      
      expect(newStore.token).toBe('persisted-token');
    });

    it('should persist token to localStorage on login', async () => {
      const mockResponse = {
        data: {
          success: true,
          token: 'new-token',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          }
        }
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      await authStore.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
    });

    it('should remove token from localStorage on logout', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

      await authStore.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('API Error Handling', () => {
    it('should extract error messages from API responses', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: 'Authentication failed',
            code: 'AUTH_FAILED'
          }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(authStore.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow();

      expect(authStore.error).toBe('Authentication failed');
    });

    it('should handle 500 server errors', async () => {
      const mockError = {
        response: {
          status: 500,
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

      expect(authStore.error).toBe('Server error occurred');
    });
  });
});