import { describe, it, expect, vi } from 'vitest';
import handler from '../health.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock the auth module  
vi.mock('../lib/auth.js', () => ({
  setCORSHeaders: vi.fn(),
  setSecurityHeaders: vi.fn(),
}));

describe('Health Endpoint', () => {
  const createMockRequest = (method = 'GET'): VercelRequest => ({
    method,
    headers: {},
    query: {},
    body: {},
  } as any);

  const createMockResponse = (): VercelResponse => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    } as any;
    return res;
  };

  it('should return 200 for OPTIONS request', async () => {
    const req = createMockRequest('OPTIONS');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('should return 405 for non-GET requests', async () => {
    const req = createMockRequest('POST');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('should return health status for GET request', async () => {
    const req = createMockRequest('GET');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        environment: expect.any(String),
        uptime: expect.any(Number),
        services: expect.objectContaining({
          database: expect.any(String),
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
          }),
        }),
      })
    );
  });

  it('should handle errors gracefully', async () => {
    const req = createMockRequest('GET');
    const res = createMockResponse();

    // Mock process.uptime to throw an error
    const originalUptime = process.uptime;
    process.uptime = vi.fn().mockImplementation(() => {
      throw new Error('Mock error');
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy',
        timestamp: expect.any(String),
        error: 'Internal server error',
      })
    );

    // Restore original function
    process.uptime = originalUptime;
  });
});