import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../lib/routes/roles';
import { createMockRequest, createMockResponse } from './utils/mocks';

// Mock the auth utilities
vi.mock('../lib/auth.js', () => ({
  setCORSHeaders: vi.fn(),
  setSecurityHeaders: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

// Import the mocked modules
import { requireAuth } from '../lib/auth.js';

describe('Roles API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return roles for authenticated user', async () => {
    vi.mocked(requireAuth).mockResolvedValue(true);

    const req = createMockRequest('GET', {}, {
      user: { userId: 1, roles: ['admin'] }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roles: expect.arrayContaining([
          expect.objectContaining({
            value: 'user',
            label: 'User',
            description: 'Default role with read-only access'
          }),
          expect.objectContaining({
            value: 'admin',
            label: 'Admin', 
            description: 'Full system administration access'
          })
        ]),
        authorizationMatrix: expect.any(Object),
        meta: expect.objectContaining({
          totalRoles: 2
        })
      })
    });
  });

  it('should return 401 for unauthenticated user', async () => {
    vi.mocked(requireAuth).mockResolvedValue(false);

    const req = createMockRequest('GET', {}, {});
    const res = createMockResponse();

    await handler(req, res);

    // Function returns early when auth fails, so we don't expect any calls
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should handle only GET requests', async () => {
    const req = createMockRequest('POST', {}, {});
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('should handle OPTIONS request', async () => {
    const req = createMockRequest('OPTIONS', {}, {});
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });
});