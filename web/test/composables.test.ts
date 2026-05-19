import { describe, it, expect, beforeEach } from 'vitest';
import { useApiError } from '../src/composables/useApiError';
import { useLoading } from '../src/composables/useLoading';
import type { ApiError } from '../src/types/api';

describe('Composables', () => {
  describe('useApiError', () => {
    it('should handle API errors with proper structure', () => {
      const { error, isError, handleError, getErrorMessage } = useApiError();

      const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        status: 400
      };

      handleError(apiError);

      expect(error.value).toEqual(apiError);
      expect(isError.value).toBe(true);
      // getErrorMessage should return user-friendly message for known codes
      expect(getErrorMessage()).toBe('Please check your input and try again.');
    });

    it('should transform raw errors to API error format', () => {
      const { error, handleError } = useApiError();

      const rawError = new Error('Something went wrong');

      handleError(rawError);

      expect(error.value?.code).toBe('UNKNOWN_ERROR');
      expect(error.value?.message).toBe('Something went wrong');
      expect(error.value?.status).toBe(0);
    });

    it('should provide user-friendly messages for known error codes', () => {
      const { handleError, getErrorMessage } = useApiError();

      const networkError: ApiError = {
        code: 'NETWORK_ERROR',
        message: 'Network failed',
        status: 0
      };

      handleError(networkError);

      expect(getErrorMessage()).toBe('Unable to connect to the server. Please check your internet connection.');
    });

    it('should clear error state', () => {
      const { error, isError, handleError, clearError } = useApiError();

      handleError({ code: 'TEST', message: 'Test error', status: 400 });
      expect(isError.value).toBe(true);

      clearError();
      expect(error.value).toBeNull();
      expect(isError.value).toBe(false);
    });

    it('should handle authentication failed errors', () => {
      const { handleError, getErrorMessage } = useApiError();

      const authError: ApiError = {
        code: 'AUTHENTICATION_FAILED',
        message: 'Login failed',
        status: 401
      };

      handleError(authError);

      expect(getErrorMessage()).toBe('Invalid email or password.');
    });

    it('should handle access denied errors', () => {
      const { handleError, getErrorMessage } = useApiError();

      const accessError: ApiError = {
        code: 'ACCESS_DENIED',
        message: 'Forbidden',
        status: 403
      };

      handleError(accessError);

      expect(getErrorMessage()).toBe('You do not have permission to perform this action.');
    });

    it('should fall back to original message for unknown error codes', () => {
      const { handleError, getErrorMessage } = useApiError();

      const unknownError: ApiError = {
        code: 'CUSTOM_ERROR',
        message: 'Something specific went wrong',
        status: 400
      };

      handleError(unknownError);

      expect(getErrorMessage()).toBe('Something specific went wrong');
    });
  });

  describe('useLoading', () => {
    beforeEach(() => {
      vi.clearAllTimers();
      vi.useFakeTimers();
    });

    it('should manage loading state during promise execution', async () => {
      const { loading, withLoading } = useLoading();

      expect(loading.value).toBe(false);

      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 100);
      });

      const resultPromise = withLoading(promise);
      
      // Should be loading immediately
      expect(loading.value).toBe(true);

      vi.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(loading.value).toBe(false);
    });

    it('should clear loading state even if promise rejects', async () => {
      const { loading, withLoading } = useLoading();

      const promise = Promise.reject(new Error('Failed'));

      try {
        await withLoading(promise);
      } catch (error) {
        expect(error.message).toBe('Failed');
      }

      expect(loading.value).toBe(false);
    });

    it('should allow manual loading state control', () => {
      const { loading, setLoading } = useLoading();

      expect(loading.value).toBe(false);

      setLoading(true);
      expect(loading.value).toBe(true);

      setLoading(false);
      expect(loading.value).toBe(false);
    });
  });
});