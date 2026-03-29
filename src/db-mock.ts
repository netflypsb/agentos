// Mock database for development/testing
// In production, this will be replaced with better-sqlite3

export interface DatabaseRow {
  [key: string]: any;
}

export class MockDatabase {
  private tables: Map<string, DatabaseRow[]> = new Map();

  exec(sql: string): void {
    // Simple mock implementation for CREATE TABLE
    if (sql.includes('CREATE TABLE')) {
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      if (tableName) {
        this.tables.set(tableName, []);
      }
    }
  }

  prepare(sql: string): MockStatement {
    return new MockStatement(sql, this.tables);
  }
}

export class MockStatement {
  private sql: string;
  private tables: Map<string, DatabaseRow[]>;

  constructor(sql: string, tables: Map<string, DatabaseRow[]>) {
    this.sql = sql;
    this.tables = tables;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    // Simple mock for INSERT/UPDATE/DELETE
    return { changes: 1, lastInsertRowid: 1 };
  }

  get(...params: any[]): DatabaseRow | undefined {
    // Simple mock for SELECT
    return undefined;
  }

  all(...params: any[]): DatabaseRow[] {
    // Simple mock for SELECT all
    return [];
  }
}

// Export mock database instance
export const db = new MockDatabase();
