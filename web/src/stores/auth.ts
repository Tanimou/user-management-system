import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '@/api/axios';

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
    const token = localStorage.getItem('accessToken');
    return !!token && !!user.value;
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
        message: error.response?.data?.error || 'Login failed' 
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
        message: error.response?.data?.error || 'Update failed' 
      };
    }
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
  };
});