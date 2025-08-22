// API Response and Error Types
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  success?: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface ListQueryParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  [key: string]: any;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RefreshTokenResponse {
  token: string;
}

// User types
export interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  avatarUrl?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password?: string;
  roles?: string[];
  isActive?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  roles?: string[];
  isActive?: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  oldPassword?: string;
  newPassword?: string;
}

export interface UsersListParams extends ListQueryParams {
  role?: string;
  active?: 'true' | 'false';
}