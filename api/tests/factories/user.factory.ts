import type { User } from '@prisma/client';
import { hashPassword } from '../../lib/auth';

export interface UserFactoryOptions {
  name?: string;
  email?: string;
  password?: string;
  roles?: string[];
  isActive?: boolean;
  avatarUrl?: string;
}

export interface MockUserData {
  id: number;
  name: string;
  email: string;
  password: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string | null;
}

/**
 * Factory class for creating test user data
 * Provides methods to create users with different roles and states
 */
export class UserFactory {
  private static userIdCounter = 1;

  /**
   * Create a mock user with specified options
   */
  static async create(options: UserFactoryOptions = {}): Promise<MockUserData> {
    const defaultPassword = 'TestPassword123!';
    const hashedPassword = await hashPassword(options.password || defaultPassword);
    const userId = this.userIdCounter++;

    return {
      id: userId,
      name: options.name || `Test User ${userId}`,
      email: options.email || `test${userId}@example.com`,
      password: hashedPassword,
      roles: options.roles || ['user'],
      isActive: options.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
      avatarUrl: options.avatarUrl || null,
    };
  }

  /**
   * Create a mock admin user
   */
  static async createAdmin(options: Omit<UserFactoryOptions, 'roles'> = {}): Promise<MockUserData> {
    return this.create({
      ...options,
      name: options.name || `Admin User ${this.userIdCounter}`,
      email: options.email || `admin${this.userIdCounter}@example.com`,
      roles: ['user', 'admin'],
    });
  }

  /**
   * Create a mock regular user
   */
  static async createUser(options: Omit<UserFactoryOptions, 'roles'> = {}): Promise<MockUserData> {
    return this.create({
      ...options,
      name: options.name || `Regular User ${this.userIdCounter}`,
      email: options.email || `user${this.userIdCounter}@example.com`,
      roles: ['user'],
    });
  }

  /**
   * Create an inactive/deactivated user
   */
  static async createInactiveUser(options: Omit<UserFactoryOptions, 'isActive'> = {}): Promise<MockUserData> {
    return this.create({
      ...options,
      name: options.name || `Inactive User ${this.userIdCounter}`,
      email: options.email || `inactive${this.userIdCounter}@example.com`,
      isActive: false,
    });
  }

  /**
   * Create multiple users at once
   */
  static async createMany(count: number, options: UserFactoryOptions = {}): Promise<MockUserData[]> {
    const users: MockUserData[] = [];
    
    for (let i = 0; i < count; i++) {
      const user = await this.create({
        ...options,
        email: options.email ? `${i}_${options.email}` : undefined,
        name: options.name ? `${options.name} ${i + 1}` : undefined,
      });
      users.push(user);
    }
    
    return users;
  }

  /**
   * Create a batch of users with different roles
   */
  static async createUserBatch(): Promise<{
    admin: MockUserData;
    users: MockUserData[];
    inactiveUser: MockUserData;
  }> {
    const admin = await this.createAdmin({
      name: 'Test Admin',
      email: 'admin@test.com',
    });

    const users = await this.createMany(3, {
      name: 'Test User',
    });

    const inactiveUser = await this.createInactiveUser({
      name: 'Inactive Test User',
      email: 'inactive@test.com',
    });

    return {
      admin,
      users,
      inactiveUser,
    };
  }

  /**
   * Reset the user ID counter (useful for test isolation)
   */
  static resetCounter(): void {
    this.userIdCounter = 1;
  }

  /**
   * Create user data without password hash (for scenarios where hash isn't needed)
   */
  static createPlain(options: UserFactoryOptions = {}): Omit<MockUserData, 'password'> {
    const userId = this.userIdCounter++;

    return {
      id: userId,
      name: options.name || `Test User ${userId}`,
      email: options.email || `test${userId}@example.com`,
      roles: options.roles || ['user'],
      isActive: options.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
      avatarUrl: options.avatarUrl || null,
    };
  }
}

/**
 * Mock API responses for testing
 */
export class MockResponseFactory {
  /**
   * Create a successful login response
   */
  static loginSuccess(user: Partial<MockUserData>, token: string = 'mock-jwt-token') {
    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Create an error response
   */
  static error(message: string, code?: string) {
    return {
      error: message,
      ...(code && { code }),
    };
  }

  /**
   * Create a paginated user list response
   */
  static userList(users: Partial<MockUserData>[], pagination?: {
    page: number;
    size: number;
    total: number;
  }) {
    return {
      success: true,
      data: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatarUrl: user.avatarUrl,
      })),
      ...(pagination && {
        pagination: {
          page: pagination.page,
          size: pagination.size,
          total: pagination.total,
          totalPages: Math.ceil(pagination.total / pagination.size),
        },
      }),
    };
  }

  /**
   * Create validation error response
   */
  static validationError(errors: Array<{ field: string; message: string }>) {
    return {
      error: 'Validation failed',
      details: errors,
      code: 'VALIDATION_ERROR',
    };
  }

  /**
   * Create rate limit error response
   */
  static rateLimitError(retryAfter: number = 60) {
    return {
      error: 'Rate limit exceeded',
      retryAfter,
      code: 'RATE_LIMIT_EXCEEDED',
    };
  }
}

/**
 * Utility functions for test data
 */
export class TestDataUtils {
  /**
   * Generate a unique email address
   */
  static generateEmail(prefix: string = 'test'): string {
    return `${prefix}${Date.now()}${Math.random().toString(36).substring(7)}@example.com`;
  }

  /**
   * Generate a test password that meets policy requirements
   */
  static generatePassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }

  /**
   * Create test dates relative to now
   */
  static createDate(daysFromNow: number = 0): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  }

  /**
   * Wait for a specified amount of time (useful for testing timeouts)
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Pre-defined test scenarios
 */
export const TestScenarios = {
  /**
   * Standard user creation scenario
   */
  userCreation: {
    valid: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      roles: ['user'],
    },
    invalidEmail: {
      name: 'John Doe',
      email: 'invalid-email',
      password: 'SecurePassword123!',
    },
    weakPassword: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: '123',
    },
    missingFields: {
      email: 'john.doe@example.com',
    },
  },

  /**
   * Login scenarios
   */
  login: {
    validCredentials: {
      email: 'user@example.com',
      password: 'ValidPassword123!',
    },
    invalidCredentials: {
      email: 'user@example.com',
      password: 'WrongPassword',
    },
    inactiveUser: {
      email: 'inactive@example.com',
      password: 'ValidPassword123!',
    },
    nonExistentUser: {
      email: 'nonexistent@example.com',
      password: 'ValidPassword123!',
    },
  },

  /**
   * Pagination scenarios
   */
  pagination: {
    firstPage: { page: 1, size: 10 },
    middlePage: { page: 3, size: 5 },
    lastPage: { page: 10, size: 10 },
    invalidPage: { page: -1, size: 10 },
    oversizedPage: { page: 1, size: 1000 },
  },
};