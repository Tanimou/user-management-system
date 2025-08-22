#!/usr/bin/env node
/**
 * Manual API Testing Script
 * This script performs manual testing of the User Management API endpoints
 * to validate functionality end-to-end.
 */

import { performance } from 'perf_hooks';

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// Test results tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function log(message: string, type: 'INFO' | 'PASS' | 'FAIL' | 'WARN' = 'INFO') {
  const colors = {
    INFO: '\x1b[36m', // Cyan
    PASS: '\x1b[32m', // Green
    FAIL: '\x1b[31m', // Red
    WARN: '\x1b[33m', // Yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${type}]${reset} ${message}`);
}

function assert(condition: boolean, message: string) {
  testsRun++;
  if (condition) {
    log(`✓ ${message}`, 'PASS');
    testsPassed++;
  } else {
    log(`✗ ${message}`, 'FAIL');
    testsFailed++;
  }
}

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  const start = performance.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        ...options.headers,
      },
      ...options,
    });
    
    const end = performance.now();
    const duration = end - start;
    
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      data,
      duration,
      headers: response.headers,
    };
  } catch (error) {
    const end = performance.now();
    return {
      status: 0,
      statusText: 'Network Error',
      data: null,
      duration: end - start,
      error: error.message,
    };
  }
}

async function testCORSHeaders() {
  log('\n=== Testing CORS Headers ===');
  
  const response = await makeRequest('/users', { method: 'OPTIONS' });
  
  assert(response.status === 200, 'OPTIONS request returns 200');
  assert(
    response.headers.get('Access-Control-Allow-Origin') === 'http://localhost:3000', 
    'CORS origin header is set correctly'
  );
  assert(
    response.headers.get('Access-Control-Allow-Methods')?.includes('GET'), 
    'CORS methods header includes GET'
  );
}

async function testAuthenticationRequired() {
  log('\n=== Testing Authentication Requirements ===');
  
  // Test without token
  const noAuthResponse = await makeRequest('/users');
  assert(noAuthResponse.status === 401, 'Returns 401 without authentication token');
  
  // Test with invalid token
  const badAuthResponse = await makeRequest('/users', {
    headers: { Authorization: 'Bearer invalid-token' }
  });
  assert(badAuthResponse.status === 401, 'Returns 401 with invalid token');
}

async function testInputValidation() {
  log('\n=== Testing Input Validation ===');
  
  // We can't create users without proper auth, but we can test the validation errors
  // This would require a mock or actual authentication setup
  log('Input validation tests require authentication setup - skipping for now', 'WARN');
}

async function testPerformance() {
  log('\n=== Testing Performance ===');
  
  // Test response times for key endpoints
  const endpoints = ['/users', '/me'];
  
  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint);
    assert(
      response.duration < 2000, 
      `${endpoint} responds in under 2 seconds (${Math.round(response.duration)}ms)`
    );
  }
}

async function testErrorHandling() {
  log('\n=== Testing Error Handling ===');
  
  // Test non-existent endpoints
  const notFoundResponse = await makeRequest('/nonexistent');
  assert(
    notFoundResponse.status === 404 || notFoundResponse.status === 405,
    'Returns appropriate error for non-existent endpoint'
  );
  
  // Test malformed requests
  const malformedResponse = await makeRequest('/users', {
    method: 'POST',
    body: 'invalid json'
  });
  assert(
    malformedResponse.status >= 400 && malformedResponse.status < 500,
    'Returns 4xx error for malformed requests'
  );
}

async function testSecurityHeaders() {
  log('\n=== Testing Security Headers ===');
  
  const response = await makeRequest('/users');
  
  const securityHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options', 
    'X-XSS-Protection',
    'Referrer-Policy'
  ];
  
  securityHeaders.forEach(header => {
    assert(
      response.headers.get(header) !== null,
      `Security header ${header} is present`
    );
  });
}

async function runTests() {
  log('🚀 Starting Manual API Tests', 'INFO');
  log(`Testing against: ${API_BASE}\n`);
  
  try {
    await testCORSHeaders();
    await testAuthenticationRequired();
    await testInputValidation();
    await testPerformance();
    await testErrorHandling();
    await testSecurityHeaders();
    
    log('\n📊 Test Results Summary:', 'INFO');
    log(`Total tests: ${testsRun}`);
    log(`Passed: ${testsPassed}`, testsPassed > 0 ? 'PASS' : 'INFO');
    log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'FAIL' : 'INFO');
    
    const successRate = testsRun > 0 ? (testsPassed / testsRun * 100).toFixed(1) : '0';
    log(`Success rate: ${successRate}%`);
    
    if (testsFailed > 0) {
      log('\n❌ Some tests failed. Please review the output above.', 'FAIL');
      process.exit(1);
    } else {
      log('\n✅ All tests passed!', 'PASS');
    }
    
  } catch (error) {
    log(`\n💥 Test execution failed: ${error.message}`, 'FAIL');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };