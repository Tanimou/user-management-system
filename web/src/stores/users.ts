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
    console.log('🔍 loadUsers called');
    loading.value = true;
    try {
      // Demo mode - return mock data if no real API
      const token = localStorage.getItem('accessToken');
      console.log('🔑 Token check:', { token: token?.substring(0, 20) + '...', isDemo: token === 'admin-token' || token === 'demo-token' });
      
      if (token === 'admin-token' || token === 'demo-token') {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        
        const demoUsers: User[] = [
          {
            id: 1,
            name: 'Demo User',
            email: 'demo@demo.com',
            roles: ['user'],
            isActive: true,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z'
          },
          {
            id: 2,
            name: 'Admin User',
            email: 'admin@demo.com',
            roles: ['admin', 'user'],
            isActive: true,
            createdAt: '2024-01-10T09:00:00Z',
            updatedAt: '2024-01-20T14:30:00Z'
          },
          {
            id: 3,
            name: 'John Doe',
            email: 'john.doe@example.com',
            roles: ['user'],
            isActive: true,
            createdAt: '2024-02-01T08:00:00Z',
            updatedAt: '2024-02-01T08:00:00Z'
          },
          {
            id: 4,
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            roles: ['user'],
            isActive: false,
            createdAt: '2024-01-20T12:00:00Z',
            updatedAt: '2024-02-15T16:45:00Z',
            deletedAt: '2024-02-15T16:45:00Z'
          },
          {
            id: 5,
            name: 'Bob Wilson',
            email: 'bob.wilson@example.com',
            roles: ['admin', 'user'],
            isActive: true,
            createdAt: '2024-01-05T07:30:00Z',
            updatedAt: '2024-01-25T11:15:00Z'
          }
        ];

        // Apply filtering
        let filteredUsers = demoUsers;
        
        if (filters.value.search) {
          const searchLower = filters.value.search.toLowerCase();
          filteredUsers = filteredUsers.filter(u => 
            u.name.toLowerCase().includes(searchLower) || 
            u.email.toLowerCase().includes(searchLower)
          );
        }
        
        if (filters.value.role !== 'all') {
          filteredUsers = filteredUsers.filter(u => 
            u.roles.includes(filters.value.role)
          );
        }
        
        if (filters.value.status !== 'all') {
          const isActive = filters.value.status === 'active';
          filteredUsers = filteredUsers.filter(u => u.isActive === isActive);
        }
        
        // Apply sorting
        filteredUsers.sort((a, b) => {
          const aVal = a[sorting.value.column as keyof User] as string;
          const bVal = b[sorting.value.column as keyof User] as string;
          const order = sorting.value.direction === 'asc' ? 1 : -1;
          return aVal < bVal ? -order : aVal > bVal ? order : 0;
        });
        
        // Apply pagination
        const start = (pagination.value.page - 1) * pagination.value.size;
        const end = start + pagination.value.size;
        const paginatedUsers = filteredUsers.slice(start, end);
        
        users.value = paginatedUsers;
        pagination.value.total = filteredUsers.length;
        pagination.value.totalPages = Math.ceil(filteredUsers.length / pagination.value.size);
        
        return;
      }

      console.log('🌐 Making real API call to /users');
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

      console.log('📡 API params:', params);
      const response = await apiClient.get('/users', { params });
      console.log('📥 Raw API response:', response);
      console.log('📥 API response.data:', response.data);
      
      // Handle both response formats - direct response or wrapped in .data
      const responseData = (response.data !== undefined) ? response.data : response as any;
      console.log('📊 Parsed responseData:', responseData);
      
      // Handle both possible response formats
      let usersArray: any[] = [];
      if (Array.isArray(responseData?.data)) {
        usersArray = responseData.data;
      } else if (Array.isArray(responseData?.items)) {
        usersArray = responseData.items;
      } else if (Array.isArray(responseData)) {
        usersArray = responseData;
      } else {
        console.error('❌ Unexpected response format:', responseData);
        usersArray = [];
      }
      
      users.value = usersArray;
      console.log('👥 Users set to:', users.value.length, 'items');
      console.log('👥 First user:', users.value[0]);
      
      // Update pagination data - API returns pagination directly on response object
      if (responseData) {
        pagination.value = {
          page: responseData.page || pagination.value.page,
          size: responseData.size || pagination.value.size,
          total: responseData.total || 0,
          totalPages: responseData.totalPages || 1
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