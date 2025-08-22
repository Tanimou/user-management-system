import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Joi from 'joi';

export function validateBody(schema: Joi.ObjectSchema) {
  return function (handler: Function) {
    return async (req: VercelRequest, res: VercelResponse) => {
      try {
        const { error, value } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true
        });

        if (error) {
          const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));

          return res.status(400).json({
            error: 'Validation failed',
            message: 'Invalid input data',
            details
          });
        }

        req.body = value;
        return handler(req, res);
      } catch (error) {
        return res.status(500).json({
          error: 'Validation error',
          message: 'Failed to validate input'
        });
      }
    };
  };
}

export function validateQuery(schema: Joi.ObjectSchema) {
  return function (handler: Function) {
    return async (req: VercelRequest, res: VercelResponse) => {
      try {
        const { error, value } = schema.validate(req.query, {
          abortEarly: false,
          stripUnknown: true
        });

        if (error) {
          const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));

          return res.status(400).json({
            error: 'Validation failed',
            message: 'Invalid query parameters',
            details
          });
        }

        req.query = value;
        return handler(req, res);
      } catch (error) {
        return res.status(500).json({
          error: 'Validation error',
          message: 'Failed to validate query parameters'
        });
      }
    };
  };
}