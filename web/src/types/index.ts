// Export all API types
export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  ListQueryParams,
  LoginCredentials,
  AuthResponse,
  RefreshTokenResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UpdateProfileRequest,
  UsersListParams
} from './api';// Re-export all types for easy imports
export * from './auth';
export * from './api';

// Vue Router meta interface
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresGuest?: boolean;
    roles?: string[];
    layout?: string;
    demo?: string;
  }
}