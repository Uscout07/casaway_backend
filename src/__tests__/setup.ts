// Test setup file
import 'jest';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup after all tests
});

// Global test utilities
global.console = {
  ...console,
  // Uncomment to suppress console.log during tests
  // log: jest.fn(),
  // Uncomment to suppress console.warn during tests
  // warn: jest.fn(),
  // Keep error logging for debugging
  error: console.error,
};
