import axios, { 
  type AxiosInstance, 
  type AxiosRequestConfig, 
  type AxiosResponse,
  type AxiosError 
} from 'axios';
import type { ApiResponse, ApiError } from '@/types/api';

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private refreshPromise: Promise<string> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      withCredentials: true, // Important for refresh token cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Log requests in development
        if (import.meta.env.DEV) {
          console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params,
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log responses in development
        if (import.meta.env.DEV) {
          console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 errors with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (newToken) {
              originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${newToken}`,
              };
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.handleAuthFailure();
            return Promise.reject(refreshError);
          }
        }

        // Log errors in development
        if (import.meta.env.DEV) {
          console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          });
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private async refreshToken(): Promise<string | null> {
    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await axios.post<{ token: string }>(`${this.baseURL}/refresh`, {}, {
          withCredentials: true, // Include refresh token cookie
        });

        const { token } = response.data;
        this.setAuthToken(token);
        return token;
      } catch (error) {
        this.clearAuthToken();
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private handleAuthFailure(): void {
    this.clearAuthToken();
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  private transformError(error: AxiosError): ApiError {
    if (!error.response) {
      // Network error
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred. Please check your connection.',
        status: 0,
      };
    }

    const { status, data } = error.response;
    const errorData = data as any; // Type assertion for response data
    
    return {
      code: errorData?.error || 'UNKNOWN_ERROR',
      message: errorData?.message || error.message || 'An unexpected error occurred',
      status,
      details: errorData?.details,
    };
  }

  // Generic HTTP methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const response = await this.client.get<T>(url, config);
    return response;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const response = await this.client.post<T>(url, data, config);
    return response;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const response = await this.client.put<T>(url, data, config);
    return response;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const response = await this.client.delete<T>(url, config);
    return response;
  }

  // Utility methods
  setAuthToken(token: string): void {
    const wasInLocalStorage = localStorage.getItem('rememberMe') === 'true';
    if (wasInLocalStorage) {
      localStorage.setItem('accessToken', token);
    } else {
      sessionStorage.setItem('accessToken', token);
    }
  }

  clearAuthToken(): void {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('rememberMe');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  }
}

// Create singleton instance
export const apiClient = new ApiClient('/api');

// Export default for backward compatibility
export default apiClient;