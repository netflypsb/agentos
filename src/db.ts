import Database from "better-sqlite3";
import { homedir } from "os";
import { mkdirSync } from "fs";
import { join } from "path";

const dbPath = join(homedir(), ".agentos");
mkdirSync(dbPath, { recursive: true });

export const db = new Database(join(dbPath, "agentos.db"));

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

// TTL cleanup background task
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM kv WHERE ttl IS NOT NULL AND ttl < ?").run(now);
  db.prepare("DELETE FROM logs WHERE timestamp < datetime('now', '-30 days')").run();
}, 3600000); // Run every hour
