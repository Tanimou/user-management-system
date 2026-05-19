import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../src/api/axios';
import type { ApiError } from '../src/types/api';

// Mock axios for testing
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: mockAxios,
    ...mockAxios,
  };
});

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Token Management', () => {
    it('should set token in localStorage when rememberMe is true', () => {
      localStorage.setItem('rememberMe', 'true');
      apiClient.setAuthToken('test-token');
      
      expect(localStorage.getItem('accessToken')).toBe('test-token');
      expect(sessionStorage.getItem('accessToken')).toBeNull();
    });

    it('should set token in sessionStorage when rememberMe is false', () => {
      localStorage.removeItem('rememberMe');
      apiClient.setAuthToken('test-token');
      
      expect(sessionStorage.getItem('accessToken')).toBe('test-token');
      expect(localStorage.getItem('accessToken')).toBeNull();
    });

    it('should retrieve token from localStorage first', () => {
      localStorage.setItem('accessToken', 'local-token');
      sessionStorage.setItem('accessToken', 'session-token');
      
      expect(apiClient.getAuthToken()).toBe('local-token');
    });

    it('should retrieve token from sessionStorage if not in localStorage', () => {
      sessionStorage.setItem('accessToken', 'session-token');
      
      expect(apiClient.getAuthToken()).toBe('session-token');
    });

    it('should clear tokens from both storages', () => {
      localStorage.setItem('accessToken', 'local-token');
      sessionStorage.setItem('accessToken', 'session-token');
      localStorage.setItem('rememberMe', 'true');
      
      apiClient.clearAuthToken();
      
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(sessionStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('rememberMe')).toBeNull();
    });
  });

  describe('Error Transformation', () => {
    it('should transform network errors correctly', () => {
      const networkError = new Error('Network Error');
      // @ts-ignore - accessing private method for testing
      const transformedError: ApiError = apiClient.transformError({ 
        message: 'Network Error',
        response: undefined 
      });

      expect(transformedError.code).toBe('NETWORK_ERROR');
      expect(transformedError.message).toBe('Network error occurred. Please check your connection.');
      expect(transformedError.status).toBe(0);
    });

    it('should transform HTTP errors with response data', () => {
      const httpError = {
        message: 'Request failed',
        response: {
          status: 400,
          data: {
            error: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: { field: 'email' }
          }
        }
      };

      // @ts-ignore - accessing private method for testing
      const transformedError: ApiError = apiClient.transformError(httpError);

      expect(transformedError.code).toBe('VALIDATION_ERROR');
      expect(transformedError.message).toBe('Invalid input data');
      expect(transformedError.status).toBe(400);
      expect(transformedError.details).toEqual({ field: 'email' });
    });

    it('should handle errors without specific error data', () => {
      const httpError = {
        message: 'Server Error',
        response: {
          status: 500,
          data: {}
        }
      };

      // @ts-ignore - accessing private method for testing
      const transformedError: ApiError = apiClient.transformError(httpError);

      expect(transformedError.code).toBe('UNKNOWN_ERROR');
      expect(transformedError.message).toBe('Server Error');
      expect(transformedError.status).toBe(500);
    });
  });
});