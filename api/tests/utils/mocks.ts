import type { VercelResponse } from '@vercel/node';
import { vi } from 'vitest';
import type { AuthenticatedRequest } from '../../lib/auth';

export function createMockRequest(
  method: string,
  queryOrCookies: Record<string, string> = {},
  additional: Partial<AuthenticatedRequest> = {},
  cookies?: Record<string, string>
): AuthenticatedRequest {
  return {
    method,
    query: cookies ? {} : queryOrCookies,
    headers: {},
    body: additional.body || {},
    cookies: cookies || (method === 'POST' ? queryOrCookies : {}),
    ...additional,
  } as AuthenticatedRequest;
}

export function createMockResponse(): VercelResponse {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as any;

  return res;
}

export function createMockUser(
  id: number,
  name: string,
  email: string,
  isActive: boolean = true,
  roles: string[] = ['user'],
  avatarUrl?: string
) {
  return {
    id,
    name,
    email,
    password: 'hashed-password', // Mock password field
    roles,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null, // Mock deletedAt field
    avatarUrl: avatarUrl || null,
  };
}

export function createMockJWTPayload(
  userId: number,
  email: string = 'test@example.com',
  roles: string[] = ['user']
) {
  return {
    userId,
    email,
    roles,
  };
}
