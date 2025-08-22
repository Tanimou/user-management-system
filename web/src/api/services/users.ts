import { apiClient } from '../axios';
import type { 
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UsersListParams,
  PaginatedResponse 
} from '@/types/api';

export class UsersService {
  async getUsers(params?: UsersListParams): Promise<PaginatedResponse<User>> {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', {
      params
    });
    return response.data!;
  }

  async getUserById(id: number): Promise<User> {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data!;
  }

  async createUser(data: CreateUserRequest): Promise<{ id: number }> {
    const response = await apiClient.post<{ id: number }>('/users', data);
    return response.data!;
  }

  async updateUser(id: number, data: UpdateUserRequest): Promise<User> {
    const response = await apiClient.put<User>(`/users/${id}`, data);
    return response.data!;
  }

  async deleteUser(id: number): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }

  async bulkUpdateUsers(ids: number[], data: Partial<UpdateUserRequest>): Promise<void> {
    await apiClient.put('/users/bulk', { ids, ...data });
  }
}

export const usersService = new UsersService();