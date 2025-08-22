import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '@/api/axios';
import type { User } from './auth';

interface Pagination {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

interface Filters {
  search: string;
  role: string;
  status: string;
}

interface Sorting {
  column: string;
  direction: 'asc' | 'desc';
}

export const useUsersStore = defineStore('users', () => {
  // State
  const users = ref<User[]>([]);
  const pagination = ref<Pagination>({
    page: 1,
    size: 10,
    total: 0,
    totalPages: 0
  });
  const filters = ref<Filters>({
    search: '',
    role: 'all',
    status: 'all'
  });
  const sorting = ref<Sorting>({
    column: 'createdAt',
    direction: 'desc'
  });
  const loading = ref(false);

  // Getters
  const filteredUsers = computed(() => users.value);

  // Actions
  async function loadUsers() {
    loading.value = true;
    try {
      const params: any = {
        page: pagination.value.page,
        size: pagination.value.size,
        search: filters.value.search || undefined,
        sort: sorting.value.column,
        dir: sorting.value.direction
      };

      // Only include role filter if not 'all'
      if (filters.value.role !== 'all') {
        params.role = filters.value.role;
      }

      // Handle status filter
      if (filters.value.status !== 'all') {
        params.active = filters.value.status === 'active';
      }

      const response = await apiClient.get('/users', { params });
      
      users.value = response.data.data || response.data.items || [];
      
      if (response.data.pagination) {
        pagination.value = {
          page: response.data.pagination.page || response.data.page,
          size: response.data.pagination.size || response.data.size,
          total: response.data.pagination.total || response.data.total,
          totalPages: response.data.pagination.totalPages || response.data.totalPages
        };
      }
      
    } catch (error) {
      console.error('Failed to load users:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function createUser(userData: any) {
    try {
      const response = await apiClient.post('/users', userData);
      await loadUsers(); // Refresh the list
      return response.data;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  async function updateUser(id: number, userData: any) {
    try {
      const response = await apiClient.put(`/users/${id}`, userData);
      await loadUsers(); // Refresh the list
      return response.data;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  async function deleteUser(id: number) {
    try {
      await apiClient.delete(`/users/${id}`);
      await loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  async function restoreUser(id: number) {
    try {
      await apiClient.post(`/users/${id}`, { action: 'restore' });
      await loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Failed to restore user:', error);
      throw error;
    }
  }

  // Filter and pagination actions
  function setSearchQuery(query: string) {
    filters.value.search = query;
    pagination.value.page = 1; // Reset to first page
  }

  function setRoleFilter(role: string) {
    filters.value.role = role;
    pagination.value.page = 1; // Reset to first page
  }

  function setStatusFilter(status: string) {
    filters.value.status = status;
    pagination.value.page = 1; // Reset to first page
  }

  function setSorting(column: string, direction: 'asc' | 'desc') {
    sorting.value.column = column;
    sorting.value.direction = direction;
    pagination.value.page = 1; // Reset to first page
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function setPageSize(size: number) {
    pagination.value.size = size;
    pagination.value.page = 1; // Reset to first page
  }

  // Reset filters
  function resetFilters() {
    filters.value = {
      search: '',
      role: 'all', 
      status: 'all'
    };
    pagination.value.page = 1;
  }

  return {
    // State
    users,
    pagination,
    filters,
    sorting,
    loading,
    
    // Getters
    filteredUsers,
    
    // Actions
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    restoreUser,
    setSearchQuery,
    setRoleFilter,
    setStatusFilter,
    setSorting,
    setPage,
    setPageSize,
    resetFilters
  };
});