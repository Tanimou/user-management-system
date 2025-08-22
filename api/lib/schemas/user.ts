import * as Joi from 'joi';

// User query parameters validation schema
export const getUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(50).default(10),
  search: Joi.string().allow('').max(100).optional(),
  active: Joi.boolean().optional(),
  sort: Joi.string().valid('name', 'email', 'createdAt').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

// User creation validation schema
export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(120).required()
    .pattern(/^[a-zA-Z\s\-'\.]+$/)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
    }),
  email: Joi.string().email().max(180).required()
    .lowercase()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string().min(8).max(128).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  roles: Joi.array().items(Joi.string().valid('user', 'admin')).min(1).default(['user'])
});

// User update validation schema
export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(120)
    .pattern(/^[a-zA-Z\s\-'\.]+$/)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
    }),
  email: Joi.string().email().max(180)
    .lowercase()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  roles: Joi.array().items(Joi.string().valid('user', 'admin')).min(1),
  isActive: Joi.boolean()
}).min(1);

// User ID parameter validation
export const userIdSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});