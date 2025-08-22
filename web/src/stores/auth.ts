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

  // Getters
  const isAuthenticated = computed(() => {
    // Check both storage locations for token
    const hasToken = !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken');
    const hasUser = !!user.value;
    console.log('Auth check:', { hasToken, hasUser, user: user.value });
    return hasToken && hasUser;
  });

  const isAdmin = computed(() => {
    return user.value?.roles.includes('admin') ?? false;
  });

  // Actions
  async function initialize() {
    // Check both storage types for token
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (token) {
      try {
        await fetchProfile();
      } catch (error) {
        // Token is invalid, remove it from both storage types
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');
        localStorage.removeItem('rememberMe');
        user.value = null;
      }
    }
  }

  async function login(email: string, password: string, rememberMe: boolean = false) {
    loading.value = true;
    try {
      // Demo mode for UI testing
      if (email === 'demo@demo.com' && password === 'demo1234') {
        const demoUser: User = {
          id: 1,
          name: 'Demo User',
          email: 'demo@demo.com',
          roles: ['user'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        localStorage.setItem('accessToken', 'demo-token');
        user.value = demoUser;
        return { success: true };
      }

      // Admin demo mode
      if (email === 'admin@demo.com' && password === 'admin1234') {
        const adminUser: User = {
          id: 2,
          name: 'Admin User',
          email: 'admin@demo.com',
          roles: ['admin', 'user'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        localStorage.setItem('accessToken', 'admin-token');
        user.value = adminUser;
        return { success: true };
      }

      const response = await apiClient.post('/login', { email, password });
      const { user: userData, token: accessToken } = response.data; // Updated to match API spec

      // Store token based on remember me preference
      if (rememberMe) {
        localStorage.setItem('accessToken', accessToken);
        // Also store a flag to indicate this is a persistent session
        localStorage.setItem('rememberMe', 'true');
      } else {
        sessionStorage.setItem('accessToken', accessToken);
        localStorage.removeItem('rememberMe');
      }

      user.value = userData;

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Login failed',
      };
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      // Clear both storage types
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('rememberMe');
      user.value = null;

      // Optional: Call logout endpoint to clear refresh token
      // This will fail silently if the API doesn't have a logout endpoint
      try {
        await apiClient.post('/logout');
      } catch (error) {
        // Ignore logout API errors
      }
    } catch (error) {
      // Even if logout fails, clear local state
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('rememberMe');
      user.value = null;
    }
  }

  async function fetchProfile() {
    try {
      const response = await apiClient.get('/me');
      user.value = response.data.data;
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
      const response = await apiClient.put('/me', data);
      user.value = response.data.data;
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Update failed',
      };
    }
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
    loading,
    // Getters
    isAuthenticated,
    isAdmin,
    // Actions
    initialize,
    login,
    logout,
    fetchProfile,
    updateProfile,
    updateUser,
    setDemoUser,
  };
});
