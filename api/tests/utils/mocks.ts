import { vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../../lib/auth';

export function createMockRequest(
  method: string,
  cookies: Record<string, string> = {},
  additional: Partial<AuthenticatedRequest> = {}
): AuthenticatedRequest {
  return {
    method,
    query: {},
    headers: {},
    body: additional.body || {},
    cookies,
    ...additional
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
    roles,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    avatarUrl: avatarUrl || null
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
    roles
  };
}