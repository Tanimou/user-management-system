import { ref, computed, readonly } from 'vue';
import type { ApiError } from '@/types/api';

export function useApiError() {
  const error = ref<ApiError | null>(null);
  const isError = computed(() => !!error.value);

  const handleError = (err: any) => {
    if (err.code && err.message) {
      // Already transformed API error
      error.value = err as ApiError;
    } else {
      // Raw error, transform it
      error.value = {
        code: 'UNKNOWN_ERROR',
        message: err.message || 'An unexpected error occurred',
        status: err.response?.status || 0,
      };
    }
  };

  const clearError = () => {
    error.value = null;
  };

  const getErrorMessage = (code?: string): string => {
    if (!error.value) return '';
    
    const errorMessages: Record<string, string> = {
      'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'AUTHENTICATION_FAILED': 'Invalid email or password.',
      'ACCESS_DENIED': 'You do not have permission to perform this action.',
      'NOT_FOUND': 'The requested resource was not found.',
      'CONFLICT': 'This information is already in use.',
      'SERVER_ERROR': 'A server error occurred. Please try again later.',
    };

    return errorMessages[error.value.code] || error.value.message;
  };

  return {
    error: readonly(error),
    isError,
    handleError,
    clearError,
    getErrorMessage,
  };
}