import apiClient from '@/api/axios';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  avatarUrl?: string;
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Initialize token from localStorage
  const initializeToken = () => {
    const storedToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (storedToken) {
      token.value = storedToken;
    }
  };

  // Call initialize on store creation
  initializeToken();

  // Getters
  const isAuthenticated = computed(() => {
    const hasToken = !!token.value;
    const hasUser = !!user.value;
    console.log('Auth check:', { hasToken, hasUser, user: user.value });
    // Both token and user must be present for authenticated state
    return hasToken && hasUser;
  });

  const isAdmin = computed(() => {
    return user.value?.roles.includes('admin') ?? false;
  });

  const isLoading = computed(() => loading.value);

  // Actions
  async function initialize() {
    if (token.value) {
      try {
        await fetchProfile();
      } catch (error) {
        // Token is invalid, clear it
        logout();
      }
    }
  }

  async function login(
    loginData: { email: string; password: string } | string,
    password?: string,
    rememberMe: boolean = false
  ) {
    loading.value = true;
    error.value = null;

    // Handle both object and individual parameter styles
    let email: string;
    let pass: string;

    if (typeof loginData === 'string') {
      email = loginData;
      pass = password!;
    } else {
      email = loginData.email;
      pass = loginData.password;
    }

    try {
      // Demo mode for UI testing
      if (email === 'demo@demo.com' && pass === 'demo1234') {
        const demoUser: User = {
          id: 1,
          name: 'Demo User',
          email: 'demo@demo.com',
          roles: ['user'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        token.value = 'demo-token';
        if (rememberMe) {
          localStorage.setItem('accessToken', 'demo-token');
          localStorage.setItem('rememberMe', 'true');
        } else {
          sessionStorage.setItem('accessToken', 'demo-token');
        }
        user.value = demoUser;
        return { success: true };
      }

      // Admin demo mode
      if (email === 'admin@demo.com' && pass === 'admin1234') {
        const adminUser: User = {
          id: 2,
          name: 'Admin User',
          email: 'admin@demo.com',
          roles: ['admin', 'user'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        token.value = 'admin-token';
        if (rememberMe) {
          localStorage.setItem('accessToken', 'admin-token');
          localStorage.setItem('rememberMe', 'true');
        } else {
          sessionStorage.setItem('accessToken', 'admin-token');
        }
        user.value = adminUser;
        return { success: true };
      }

      const response = await apiClient.post('/login', {
        email,
        password: pass,
      });
      console.log('Login API response:', response);

      // Handle different response formats - the response might be the data directly or wrapped
      let responseData;
      if (response.data) {
        responseData = response.data;
      } else {
        responseData = response;
      }
      
      console.log('Parsed response data:', responseData);
      
      const { token: accessToken, user: userData } = responseData as any;
      console.log('Extracted token:', accessToken);
      console.log('Extracted user:', userData);

      if (!accessToken || !userData) {
        throw new Error('Invalid response: missing token or user data');
      }

      // Store token based on remember me preference
      if (rememberMe) {
        localStorage.setItem('accessToken', accessToken);
        // Also store a flag to indicate this is a persistent session
        localStorage.setItem('rememberMe', 'true');
      } else {
        sessionStorage.setItem('accessToken', accessToken);
        localStorage.removeItem('rememberMe');
      }

      token.value = accessToken;
      user.value = userData;

      return { success: true };
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      error.value = errorMessage;

      // Clear any existing token on failure
      token.value = null;
      user.value = null;
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');

      // Check for specific error types that tests expect to throw
      if (err.response?.status === 401) {
        error.value = err.response.data.error;
        throw new Error(errorMessage);
      }
      if (err.response?.status === 500) {
        error.value = 'Server error occurred';
        throw new Error('Server error occurred');
      }
      if (err.message === 'Network Error') {
        error.value = 'Network error occurred';
        throw new Error('Network Error');
      }

      throw new Error(errorMessage);
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    // Immediately clear local state first to prevent race conditions
    const tokenToRevoke = token.value;
    token.value = null;
    user.value = null;
    error.value = null;
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('rememberMe');

    // Then try to call logout endpoint (optional)
    if (tokenToRevoke) {
      try {
        await apiClient.post('/logout');
      } catch (error) {
        // Ignore logout API errors - local state is already cleared
        console.warn('Logout API call failed:', error);
      }
    }
  }

  async function fetchProfile() {
    try {
      const response = await apiClient.get<{ user?: User; data?: User }>('/me');
      user.value = response.data?.user || response.data?.data || null;
      return user.value;
    } catch (error) {
      throw error;
    }
  }

  async function updateProfile(data: {
    name?: string;
    password?: string;
    currentPassword?: string;
  }) {
    try {
      const response = await apiClient.put<{ user?: User; data?: User }>(
        '/me',
        data
      );
      user.value = response.data?.user || response.data?.data || null;
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Update failed',
      };
    }
  }

  async function refreshToken() {
    try {
      const response = await apiClient.post<{ token: string }>('/refresh');
      const newToken = response.data?.token;
      if (newToken) {
        token.value = newToken;
        localStorage.setItem('auth_token', newToken);
      }
    } catch (error) {
      // If refresh fails, logout user
      await logout();
    }
  }

  function clearError() {
    error.value = null;
  }

  function setError(message: string) {
    error.value = message;
  }

  function hasRole(role: string): boolean {
    return user.value?.roles.includes(role) ?? false;
  }

  function updateUser(userData: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...userData };
    }
  }

  function setDemoUser(demoUser: User) {
    user.value = demoUser;
  }

  return {
    // State
    user,
    token,
    loading,
    error,
    // Getters
    isAuthenticated,
    isAdmin,
    isLoading,
    // Actions
    initialize,
    login,
    logout,
    fetchProfile,
    updateProfile,
    refreshToken,
    clearError,
    setError,
    hasRole,
    updateUser,
    setDemoUser,
  };
});
