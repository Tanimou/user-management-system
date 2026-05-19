import { ref, reactive, readonly } from 'vue';
import { usersService } from '@/api/services/users';
import { useApiError } from './useApiError';
import { useLoading } from './useLoading';
import type { User, UsersListParams, CreateUserRequest, UpdateUserRequest } from '@/types/api';

export function useUsers() {
  const users = ref<User[]>([]);
  const pagination = reactive({
    page: 1,
    size: 10,
    total: 0,
    totalPages: 0,
  });

  const { loading, withLoading } = useLoading();
  const { handleError } = useApiError();

  const fetchUsers = async (params?: UsersListParams) => {
    try {
      const response = await withLoading(
        usersService.getUsers({ ...params, page: pagination.page, size: pagination.size })
      );
      
      users.value = response.items;
      Object.assign(pagination, {
        page: response.page,
        size: response.size,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch (error) {
      handleError(error);
    }
  };

  const createUser = async (userData: CreateUserRequest) => {
    try {
      await withLoading(usersService.createUser(userData));
      await fetchUsers(); // Refresh list
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const updateUser = async (id: number, userData: UpdateUserRequest) => {
    try {
      const updatedUser = await withLoading(usersService.updateUser(id, userData));
      
      // Update local state
      const index = users.value.findIndex(u => u.id === id);
      if (index !== -1) {
        users.value[index] = updatedUser;
      }
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const deleteUser = async (id: number) => {
    try {
      await withLoading(usersService.deleteUser(id));
      
      // Remove from local state
      users.value = users.value.filter(u => u.id !== id);
      pagination.total -= 1;
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  return {
    users: readonly(users),
    pagination: readonly(pagination),
    loading,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
}