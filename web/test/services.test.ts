import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../src/api/services/auth';
import { usersService } from '../src/api/services/users';
import type { LoginCredentials, CreateUserRequest, UpdateUserRequest } from '../src/types/api';

// Mock the API client
vi.mock('../src/api/axios', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    clearAuthToken: vi.fn(),
  }
}));

import { apiClient } from '../src/api/axios';
const mockApiClient = vi.mocked(apiClient);

describe('Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthService', () => {
    it('should login with credentials', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };
      const mockResponse = {
        data: {
          token: 'access-token',
          user: { id: 1, name: 'Test User', email: 'test@example.com' }
        }
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/login', credentials);
      expect(result.token).toBe('access-token');
      expect(result.user.id).toBe(1);
    });

    it('should refresh token', async () => {
      const mockResponse = {
        data: { token: 'new-access-token' }
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshToken();

      expect(mockApiClient.post).toHaveBeenCalledWith('/refresh');
      expect(result.token).toBe('new-access-token');
    });

    it('should logout and clear token', async () => {
      mockApiClient.post.mockResolvedValue({});

      await authService.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/logout');
      expect(mockApiClient.clearAuthToken).toHaveBeenCalled();
    });

    it('should get current user', async () => {
      const mockResponse = {
        data: { id: 1, name: 'Test User', email: 'test@example.com' }
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await authService.getCurrentUser();

      expect(mockApiClient.get).toHaveBeenCalledWith('/me');
      expect(result.id).toBe(1);
    });

    it('should update profile', async () => {
      const profileData = { name: 'Updated Name' };
      const mockResponse = {
        data: { id: 1, name: 'Updated Name', email: 'test@example.com' }
      };

      mockApiClient.put.mockResolvedValue(mockResponse);

      const result = await authService.updateProfile(profileData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/me', profileData);
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('UsersService', () => {
    it('should get users with pagination', async () => {
      const params = { page: 1, size: 10 };
      const mockResponse = {
        data: {
          items: [{ id: 1, name: 'User 1' }],
          page: 1,
          size: 10,
          total: 1,
          totalPages: 1
        }
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await usersService.getUsers(params);

      expect(mockApiClient.get).toHaveBeenCalledWith('/users', { params });
      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(1);
    });

    it('should get user by id', async () => {
      const mockResponse = {
        data: { id: 1, name: 'Test User', email: 'test@example.com' }
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await usersService.getUserById(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/users/1');
      expect(result.id).toBe(1);
    });

    it('should create user', async () => {
      const userData: CreateUserRequest = {
        name: 'New User',
        email: 'new@example.com'
      };
      const mockResponse = {
        data: { id: 2 }
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await usersService.createUser(userData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/users', userData);
      expect(result.id).toBe(2);
    });

    it('should update user', async () => {
      const userData: UpdateUserRequest = { name: 'Updated User' };
      const mockResponse = {
        data: { id: 1, name: 'Updated User', email: 'test@example.com' }
      };

      mockApiClient.put.mockResolvedValue(mockResponse);

      const result = await usersService.updateUser(1, userData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/users/1', userData);
      expect(result.name).toBe('Updated User');
    });

    it('should delete user', async () => {
      mockApiClient.delete.mockResolvedValue({});

      await usersService.deleteUser(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/users/1');
    });

    it('should bulk update users', async () => {
      const ids = [1, 2, 3];
      const updateData = { isActive: false };
      
      mockApiClient.put.mockResolvedValue({});

      await usersService.bulkUpdateUsers(ids, updateData);

      expect(mockApiClient.put).toHaveBeenCalledWith('/users/bulk', { 
        ids, 
        isActive: false 
      });
    });
  });
});