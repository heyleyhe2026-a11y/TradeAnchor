// Jest setup file for global test configuration
require('dotenv').config();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tradewise_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/tradewise_test';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test setup
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

// Global test teardown
afterAll(() => {
  console.log('✅ Test suite completed');
});
