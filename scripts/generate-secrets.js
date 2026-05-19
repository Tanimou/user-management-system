#!/usr/bin/env node
// scripts/generate-secrets.js

const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

console.log('Production JWT Secrets (Store these securely):');
console.log('');
console.log('JWT_ACCESS_SECRET=' + generateSecret());
console.log('JWT_REFRESH_SECRET=' + generateSecret());
console.log('');
console.log('Add these to your Vercel environment variables:');
console.log('vercel env add JWT_ACCESS_SECRET');
console.log('vercel env add JWT_REFRESH_SECRET');