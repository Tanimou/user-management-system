import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';

export interface ApiError {
  error: string;
  message: string;
  details?: any;
  timestamp?: string;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function handleApiError(error: any, res: VercelResponse): void {
  console.error('API Error:', error);

  // Prisma errors
  if (error && typeof error === 'object' && error.code && error.meta !== undefined) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Conflict',
          message: 'A record with this information already exists',
          details: { field: error.meta?.target }
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Not found',
          message: 'The requested resource was not found'
        });
      default:
        return res.status(400).json({
          error: 'Database error',
          message: 'An error occurred while processing your request'
        });
    }
  }

  // Custom application errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      message: error.message
    });
  }

  // Validation errors
  if (error && error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message,
      details: error.details
    });
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
}

export function withErrorHandling(handler: Function) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return handleApiError(error, res);
    }
  };
}