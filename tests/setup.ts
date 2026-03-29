// Jest test setup file

import { tmpdir } from 'os';
import { join } from 'path';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AGENTOS_DATA_DIR = join(tmpdir(), 'agentos-test');

// Mock better-sqlite3 for testing
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => {
    // Mock database instance
    const mockDb = {
      exec: jest.fn(),
      prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn()
      })
    };
    
    // Initialize schema in constructor
    mockDb.exec(`
      CREATE TABLE kv (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        ttl INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (namespace, key)
      );

      CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        action TEXT NOT NULL,
        input_summary TEXT,
        output_summary TEXT,
        duration_ms INTEGER,
        metadata TEXT
      );

      CREATE TABLE usage_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        feature TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        last_updated INTEGER DEFAULT (unixepoch()),
        UNIQUE(date, feature)
      );

      CREATE INDEX idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX idx_logs_tool_action ON logs(tool_name, action);
      CREATE INDEX idx_logs_date ON logs(date(timestamp));
    `);
    
    return mockDb;
  });
});

// Global test utilities
declare global {
  var testDb: any;
}
