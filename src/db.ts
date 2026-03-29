import { homedir } from "os";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import initSqlJs from "sql.js";

const dbPath = join(homedir(), ".agentos");
mkdirSync(dbPath, { recursive: true });
const dbFilePath = join(dbPath, "agentos.db");

let SQL: any;
let db: any;

// Initialize database
async function initializeDatabase() {
  SQL = await initSqlJs();
  
  try {
    // Try to load existing database
    const fileBuffer = readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } catch (error) {
    // Create new database if file doesn't exist
    db = new SQL.Database();
  }

  // Initialize all tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      ttl INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (namespace, key)
    );
    
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      tool_name TEXT,
      action TEXT,
      input_summary TEXT,
      output_summary TEXT,
      duration_ms INTEGER,
      metadata TEXT
    );
    
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      state_data TEXT,
      checkpoints TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT,
      total_tokens INTEGER DEFAULT 0,
      total_cost_cents INTEGER DEFAULT 0,
      action_count INTEGER DEFAULT 0,
      loop_detection TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      expires_at INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      template_content TEXT NOT NULL,
      variables TEXT,
      is_builtin BOOLEAN DEFAULT 0,
      created_by TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings TEXT,
      resource_limits TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT,
      joined_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );
  `);

  // Save database
  saveDatabase();
}

// Save database to file
function saveDatabase() {
  try {
    const data = db.export();
    writeFileSync(dbFilePath, Buffer.from(data));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Export database instance
export { db };

// Initialize the database
initializeDatabase().catch(console.error);

// TTL cleanup background task
setInterval(() => {
  if (db) {
    try {
      const now = Math.floor(Date.now() / 1000);
      db.run("DELETE FROM kv WHERE ttl IS NOT NULL AND ttl < ?", now);
      db.run("DELETE FROM logs WHERE timestamp < datetime('now', '-30 days')");
      saveDatabase();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}, 3600000); // Run every hour

// Auto-save on process exit
process.on('exit', saveDatabase);
process.on('SIGINT', saveDatabase);
process.on('SIGTERM', saveDatabase);
