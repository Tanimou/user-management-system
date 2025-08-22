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
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        await fetchProfile();
      } catch (error) {
        // Token is invalid, remove it
        localStorage.removeItem('accessToken');
        user.value = null;
      }
    }
  }

  async function login(email: string, password: string) {
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
          updatedAt: new Date().toISOString()
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
          updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('accessToken', 'admin-token');
        user.value = adminUser;
        return { success: true };
      }
      
      const response = await apiClient.post('/login', { email, password });
      const { user: userData, token: accessToken } = response.data; // Updated to match API spec
      
      // Store token and user
      localStorage.setItem('accessToken', accessToken);
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
      // Clear local storage
      localStorage.removeItem('accessToken');
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
    setDemoUser,
  };
});