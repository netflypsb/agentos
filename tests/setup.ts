// Jest test setup file

import { tmpdir } from 'os';
import { join } from 'path';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AGENTOS_DATA_DIR = join(tmpdir(), 'agentos-test');

// Create a mock database instance
const createMockDb = () => ({
  exec: jest.fn(),
  run: jest.fn(),
  prepare: jest.fn().mockReturnValue({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  })
});

// Mock sql.js for testing
jest.mock('sql.js', () => {
  return {
    default: jest.fn().mockResolvedValue({
      Database: jest.fn().mockImplementation(() => createMockDb())
    })
  };
});

// Global test utilities
declare global {
  var testDb: any;
}
