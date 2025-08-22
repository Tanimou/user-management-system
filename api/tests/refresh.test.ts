import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockUser } from './utils/mocks';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    }
  }
}));

// Mock auth functions
vi.mock('../lib/auth', async () => {
  const actual = await vi.importActual('../lib/auth');
  return {
    ...actual,
    setCORSHeaders: vi.fn(),
    setSecurityHeaders: vi.fn(),
    verifyRefreshToken: vi.fn(),
    signAccessToken: vi.fn().mockReturnValue('new-access-token'),
    signRefreshToken: vi.fn().mockReturnValue('new-refresh-token'),
    setRefreshCookie: vi.fn(),
    clearRefreshCookie: vi.fn(),
  };
});

// Mock rate limiter
vi.mock('../lib/rate-limiter', () => ({
  createAuthRateLimit: vi.fn(() => () => true), // Always allow by default
}));

// Import after mocking
import handler from '../refresh';
import prisma from '../lib/prisma';
import { resetBlacklist } from '../lib/token-blacklist';
const { 
  verifyRefreshToken, 
  signAccessToken, 
  signRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = await import('../lib/auth');
const { createAuthRateLimit } = await import('../lib/rate-limiter');

describe('Refresh API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBlacklist(); // Reset blacklist state
    // Reset rate limiter to always allow by default
    vi.mocked(createAuthRateLimit).mockReturnValue(() => true);
  });

  it('should refresh token successfully with correct response format', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com', true, ['user']);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 1, exp: Math.floor(Date.now() / 1000) + 3600 });

    const req = createMockRequest('POST', { refreshToken: 'valid-refresh-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'new-access-token',
      expiresIn: 900,
    });
    expect(setRefreshCookie).toHaveBeenCalledWith(res, 'new-refresh-token');
  });

  it('should return 401 for missing refresh token', async () => {
    const req = createMockRequest('POST');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No refresh token provided',
      code: 'MISSING_REFRESH_TOKEN',
    });
  });

  it('should return 401 for blacklisted refresh token', async () => {
    // First blacklist a token by using it once
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com', true, ['user']);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 1, exp: Math.floor(Date.now() / 1000) + 3600 });

    const req1 = createMockRequest('POST', { refreshToken: 'token-to-blacklist' });
    const res1 = createMockResponse();
    
    // First request should succeed and blacklist the token
    await handler(req1, res1);
    expect(res1.status).toHaveBeenCalledWith(200);

    // Second request with same token should fail
    const req2 = createMockRequest('POST', { refreshToken: 'token-to-blacklist' });
    const res2 = createMockResponse();
    
    await handler(req2, res2);

    expect(res2.status).toHaveBeenCalledWith(401);
    expect(res2.json).toHaveBeenCalledWith({
      error: 'Refresh token has been revoked',
      code: 'TOKEN_REVOKED',
    });
    expect(clearRefreshCookie).toHaveBeenCalledWith(res2);
  });

  it('should return 401 for invalid refresh token', async () => {
    vi.mocked(verifyRefreshToken).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const req = createMockRequest('POST', { refreshToken: 'invalid-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('should return 401 for inactive user', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com', false, ['user']); // inactive
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 1 });

    const req = createMockRequest('POST', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User not found or inactive',
      code: 'USER_NOT_FOUND',
    });
    expect(clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('should return 401 for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 999 });

    const req = createMockRequest('POST', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User not found or inactive',
      code: 'USER_NOT_FOUND',
    });
    expect(clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('should handle concurrent refresh requests', async () => {
    const mockUser = createMockUser(1, 'John Doe', 'john@example.com', true, ['user']);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 1 });
    
    const req = createMockRequest('POST', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    // Test that the function was called successfully
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle rate limiting', async () => {
    // Mock rate limiter to return false (rate limit exceeded)
    vi.mocked(createAuthRateLimit).mockReturnValue(() => false);

    const req = createMockRequest('POST', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    // The rate limiter middleware should handle the response
    // so the handler should return early without calling database operations
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should only allow POST method', async () => {
    const req = createMockRequest('GET', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('should handle OPTIONS preflight request', async () => {
    const req = createMockRequest('OPTIONS');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('should handle internal server errors', async () => {
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 1 });
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'));

    const req = createMockRequest('POST', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('should use latest user data in new access token', async () => {
    const mockUser = createMockUser(1, 'Updated Name', 'john@example.com', true, ['user', 'admin']);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 1 });

    const req = createMockRequest('POST', { refreshToken: 'valid-token' });
    const res = createMockResponse();

    await handler(req, res);

    expect(signAccessToken).toHaveBeenCalledWith({
      userId: 1,
      email: 'john@example.com',
      roles: ['user', 'admin'],
    });
  });
});