import { apiClient } from '../axios';
import type { 
  LoginCredentials, 
  AuthResponse, 
  RefreshTokenResponse,
  User,
  UpdateProfileRequest 
} from '@/types/api';

export class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/login', credentials);
    return response.data!;
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    const response = await apiClient.post<RefreshTokenResponse>('/refresh');
    return response.data!;
  }

  async logout(): Promise<void> {
    await apiClient.post('/logout');
    apiClient.clearAuthToken();
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/me');
    return response.data!;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const response = await apiClient.put<User>('/me', data);
    return response.data!;
  }
}

export const authService = new AuthService();