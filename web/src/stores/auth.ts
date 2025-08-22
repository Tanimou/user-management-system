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
  const loading = ref(false);
  const token = ref<string | null>(null);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => {
    const hasToken = !!token.value;
    const hasUser = !!user.value;
    console.log('Auth check:', { hasToken, hasUser, user: user.value });
    return hasToken && hasUser;
  });

  const isLoading = computed(() => loading.value);

  const isAdmin = computed(() => {
    return user.value?.roles.includes('admin') ?? false;
  });

  // Actions
  async function initialize() {
    // Check both storage types for token
    const storedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (storedToken) {
      token.value = storedToken;
      try {
        await fetchProfile();
      } catch (catchError) {
        // Token is invalid, remove it from both storage types
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('rememberMe');
        token.value = null;
        user.value = null;
      }
    }
  }

  async function login(data: { email: string; password: string }, rememberMe: boolean = false) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiClient.post('/login', data);
      const { user: userData, token: accessToken } = response.data;

      // Store token and user
      token.value = accessToken;
      user.value = userData;
      
      // Store token in localStorage
      localStorage.setItem('auth_token', accessToken);
      
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Login failed';
      error.value = errorMessage;
      
      // Reset state
      token.value = null;
      user.value = null;
      
      throw new Error(errorMessage);
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      // Clear token and state
      token.value = null;
      user.value = null;
      error.value = null;
      
      // Clear both storage types
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('rememberMe');

      // Optional: Call logout endpoint to clear refresh token
      try {
        await apiClient.post('/logout');
      } catch (logoutError) {
        // Ignore logout API errors
      }
    } catch (catchError) {
      // Even if logout fails, clear local state
      token.value = null;
      user.value = null;
      error.value = null;
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('rememberMe');
    }
  }

  async function fetchProfile() {
    try {
      const response = await apiClient.get('/me');
      user.value = response.data.user || response.data.data;
      return user.value;
    } catch (fetchError) {
      throw fetchError;
    }
  }

  async function updateProfile(data: {
    name?: string;
    password?: string;
    currentPassword?: string;
  }) {
    try {
      const response = await apiClient.put('/me', data);
      user.value = response.data.user || response.data.data;
      return user.value;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Update failed';
      error.value = errorMessage;
      throw new Error(errorMessage);
    }
  }

  async function refreshToken() {
    try {
      const response = await apiClient.post('/refresh');
      const { token: newToken } = response.data;
      
      token.value = newToken;
      localStorage.setItem('auth_token', newToken);
      
      return response.data;
    } catch (refreshError: any) {
      // Refresh failed, logout user
      await logout();
      throw refreshError;
    }
  }

  function updateUser(userData: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...userData };
    }
  }

  function setDemoUser(demoUser: User) {
    user.value = demoUser;
    token.value = 'demo-token';
    localStorage.setItem('auth_token', 'demo-token');
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

  return {
    // State
    user,
    loading,
    token,
    error,
    // Getters
    isAuthenticated,
    isLoading,
    isAdmin,
    // Actions
    initialize,
    login,
    logout,
    fetchProfile,
    updateProfile,
    updateUser,
    setDemoUser,
    refreshToken,
    clearError,
    setError,
    hasRole,
  };
});
