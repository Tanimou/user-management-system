import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, setSecurityHeaders } from './lib/auth.js';
import { calculatePasswordStrength } from './lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS and security headers
  setCORSHeaders(res);
  setSecurityHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    // Validate input
    if (!password) {
      return res.status(400).json({ 
        error: 'Password is required',
        code: 'MISSING_PASSWORD'
      });
    }

    if (typeof password !== 'string') {
      return res.status(400).json({ 
        error: 'Password must be a string',
        code: 'INVALID_PASSWORD_TYPE'
      });
    }

    // Calculate password strength
    const result = calculatePasswordStrength(password);

    return res.status(200).json({
      strength: result.strength,
      score: result.score,
      feedback: result.feedback,
      isValid: result.isValid
    });
  } catch (error) {
    console.error('Password validation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}