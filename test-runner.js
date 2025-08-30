#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Speed Test Backend Tests...\n');

try {
  // Install dependencies if needed
  console.log('📦 Installing test dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Run unit tests
  console.log('\n🧪 Running Unit Tests...');
  execSync('npm test -- --testPathPattern=speedTestController.test.ts', { stdio: 'inherit' });
  
  // Run integration tests
  console.log('\n🔗 Running Integration Tests...');
  execSync('npm test -- --testPathPattern=speedTest.integration.test.ts', { stdio: 'inherit' });
  
  // Run all tests with coverage
  console.log('\n📊 Running All Tests with Coverage...');
  execSync('npm run test:coverage', { stdio: 'inherit' });
  
  console.log('\n✅ All tests completed successfully!');
  
} catch (error) {
  console.error('\n❌ Test execution failed:', error.message);
  process.exit(1);
}
