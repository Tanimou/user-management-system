/**
 * Password validation utilities for user management system
 * Implements secure password policy and strength calculation
 */

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface PasswordStrengthResult {
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number; // 0-100
  feedback: string[];
  isValid: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Default password policy based on security requirements
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

// Common weak passwords patterns (subset for security)
const COMMON_PATTERNS = [
  'password', '123456', 'qwerty', 'admin', 'letmein',
  'welcome', 'monkey', 'dragon', '1234567', 'password123'
];

/**
 * Validates password against policy requirements
 */
export function validatePasswordPolicy(
  password: string, 
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): ValidationResult {
  const errors: string[] = [];

  // Length checks
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  
  if (password.length > policy.maxLength) {
    errors.push(`Password must not exceed ${policy.maxLength} characters`);
  }

  // Character type requirements
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculates password strength and provides feedback
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  let score = 0;
  const feedback: string[] = [];
  
  // Length scoring (up to 25 points)
  if (password.length >= 8) score += 10;
  if (password.length >= 10) score += 5;
  if (password.length >= 12) score += 5;
  if (password.length >= 16) score += 5;
  
  // Character variety scoring (up to 40 points)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  
  let characterTypes = 0;
  if (hasLower) { score += 10; characterTypes++; }
  if (hasUpper) { score += 10; characterTypes++; }
  if (hasNumbers) { score += 10; characterTypes++; }
  if (hasSpecial) { score += 10; characterTypes++; }
  
  // Complexity patterns (up to 20 points)
  if (password.length >= 12 && characterTypes >= 3) score += 10;
  if (password.length >= 16 && characterTypes === 4) score += 10;
  
  // Penalty for common patterns (up to -15 points)
  const lowerPassword = password.toLowerCase();
  const hasCommonPattern = COMMON_PATTERNS.some(pattern => 
    lowerPassword.includes(pattern)
  );
  if (hasCommonPattern) score -= 15;
  
  // Simple repetition check (penalty up to -10 points)
  if (/(.)\1{2,}/.test(password)) score -= 10;
  
  // Sequential characters check (penalty up to -10 points)
  if (/123|234|345|456|567|678|789|890|abc|bcd|cde|def/.test(lowerPassword)) {
    score -= 10;
  }
  
  // Entropy bonus (up to 15 points)
  const uniqueChars = new Set(password).size;
  if (uniqueChars > password.length * 0.6) score += 10;
  if (uniqueChars === password.length) score += 5;
  
  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));
  
  // Determine strength level (adjusted thresholds)
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) strength = 'weak';
  else if (score < 65) strength = 'fair';
  else if (score < 80) strength = 'good';
  else strength = 'strong';
  
  // Generate feedback
  if (characterTypes < 3) {
    feedback.push('Add more character types (uppercase, lowercase, numbers, symbols)');
  }
  if (password.length < 10) {
    feedback.push('Consider making it longer (10+ characters recommended)');
  }
  if (password.length < 12 && strength !== 'strong') {
    feedback.push('Use 12+ characters for better security');
  }
  if (hasCommonPattern) {
    feedback.push('Avoid common words and patterns');
  }
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('Avoid repeating characters');
  }
  if (!hasSpecial && characterTypes < 4) {
    feedback.push('Add special characters like !@#$%^&*');
  }
  
  // Positive feedback for strong passwords
  if (strength === 'strong') {
    feedback.push('Excellent password strength!');
  } else if (strength === 'good') {
    feedback.push('Good password strength');
  }

  // Check if password meets basic policy
  const policyResult = validatePasswordPolicy(password);
  
  return {
    strength,
    score,
    feedback,
    isValid: policyResult.isValid
  };
}

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else {
    // More strict email validation
    const emailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Please enter a valid email address');
    }
    
    if (email.length > 180) {
      errors.push('Email must not exceed 180 characters');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates user name
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Name is required');
  } else {
    if (name.trim().length > 120) {
      errors.push('Name must not exceed 120 characters');
    }
    
    if (name.trim().length < 1) {
      errors.push('Name must be at least 1 character long');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}