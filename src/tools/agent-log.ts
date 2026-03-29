import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";
import { homedir } from "os";
import { mkdirSync, appendFileSync, readFileSync } from "fs";
import { join } from "path";
import { LicenseManager, UsageTracker, LicenseTier } from "../license.js";
import { AgentErrorFactory, ValidationUtils, withErrorHandling, ErrorCode } from "../errors.js";

// JSONL logging setup
const logDir = join(homedir(), ".agentos", "logs");
mkdirSync(logDir, { recursive: true });

// Initialize usage tracking
UsageTracker.initialize(db);

// Enhanced database schema for better performance
db.exec(`
  -- Add indexes for faster search
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_tool_action ON logs(tool_name, action);
  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date(timestamp));
  
  -- Add log rotation tracking
  CREATE TABLE IF NOT EXISTS log_rotation (
    id INTEGER PRIMARY KEY,
    date TEXT UNIQUE,
    file_path TEXT,
    entry_count INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// JSONL append-only logging function
function appendToJSONL(entry: any): void {
  const today = new Date().toISOString().split('T')[0];
  const logFile = join(logDir, `agentos-${today}.jsonl`);
  
  try {
    appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write to JSONL log:', error);
  }
}

// Log rotation function
function rotateLogs(): void {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if today's log rotation is already tracked
  const existing = db.prepare(`
    SELECT * FROM log_rotation WHERE date = ?
  `).get(today);
  
  if (!existing) {
    const logFile = join(logDir, `agentos-${today}.jsonl`);
    
    try {
      const content = readFileSync(logFile, 'utf8');
      const entryCount = content.split('\n').filter(line => line.trim()).length;
      
      // Track rotation
      db.prepare(`
        INSERT INTO log_rotation (date, file_path, entry_count)
        VALUES (?, ?, ?)
      `).run(today, logFile, entryCount);
      
      // Clean up old logs (keep 30 days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoff = cutoffDate.toISOString().split('T')[0];
      
      db.prepare(`
        DELETE FROM log_rotation WHERE date < ?
      `).run(cutoff);
      
    } catch (error) {
      // File doesn't exist yet, that's okay
    }
  }
}

export function registerLogTools(server: McpServer) {
  server.tool(
    "log_action",
    "Append a structured log entry for debugging and audit trail.",
    {
      tool_name: z.string().describe("Name of the tool being logged"),
      action: z.string().describe("Action being performed"),
      input_summary: z.string().optional().describe("Brief summary of input"),
      output_summary: z.string().optional().describe("Brief summary of output"),
      duration_ms: z.number().optional().describe("Duration in milliseconds"),
      metadata: z.string().optional().describe("Additional metadata as JSON"),
    },
    withErrorHandling(async ({ tool_name, action, input_summary, output_summary, duration_ms, metadata }) => {
      // Get license key from environment
      const licenseKey = process.env.AGENTOS_LICENSE_KEY;
      const license = await LicenseManager.validateLicense(licenseKey);

      // Check if user can use logging
      const canLog = LicenseManager.canUseFeature(license, "agent_log_limited");
      if (!canLog) {
        const upgradePrompt = LicenseManager.getUpgradePrompt(license);
        throw AgentErrorFactory.create(
          ErrorCode.DAILY_LIMIT_EXCEEDED,
          upgradePrompt
        );
      }

      // Check daily limit for free tier
      const today = new Date().toISOString().split('T')[0];
      const dailyCount = UsageTracker.getDailyUsage("agent_log", today);

      if (license.tier === LicenseTier.FREE && dailyCount >= license.limits.dailyLogs) {
        const upgradePrompt = LicenseManager.getUpgradePrompt(license);
        throw AgentErrorFactory.create(
          ErrorCode.DAILY_LIMIT_EXCEEDED,
          `Daily log limit reached (${dailyCount}/${license.limits.dailyLogs}). ${upgradePrompt}`
        );
      }

      // Validate inputs
      const validatedToolName = ValidationUtils.validateString(tool_name, 1, 100);
      const validatedAction = ValidationUtils.validateString(action, 1, 100);
      const validatedInputSummary = input_summary ? 
        ValidationUtils.validateString(input_summary, 0, 500) : null;
      const validatedOutputSummary = output_summary ? 
        ValidationUtils.validateString(output_summary, 0, 500) : null;
      const validatedDuration = duration_ms ? 
        ValidationUtils.validateNumber(duration_ms, 0, 3600000) : null; // Max 1 hour
      const validatedMetadata = metadata ? ValidationUtils.validateJSON(metadata) : null;

      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        tool_name: validatedToolName,
        action: validatedAction,
        input_summary: validatedInputSummary,
        output_summary: validatedOutputSummary,
        duration_ms: validatedDuration,
        metadata: validatedMetadata
      };

      // Insert into SQLite
      db.prepare(`
        INSERT INTO logs (timestamp, tool_name, action, input_summary, output_summary, duration_ms, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(timestamp, validatedToolName, validatedAction, validatedInputSummary, validatedOutputSummary, validatedDuration, validatedMetadata);

      // Append to JSONL log
      appendToJSONL(logEntry);

      // Trigger log rotation check
      rotateLogs();

      // Track usage for free tier
      if (license.tier === LicenseTier.FREE) {
        UsageTracker.trackUsage("agent_log");
      }

      const remainingLogs = license.tier === LicenseTier.FREE ? 
        ` (${license.limits.dailyLogs - (dailyCount + 1)} remaining today)` : "";

      return {
        content: [{ 
          type: "text", 
          text: `Logged action: ${validatedToolName}.${validatedAction}${remainingLogs}` 
        }],
      };
    })
  );

  server.tool(
    "log_summary",
    "Get a summary of log activity for a time period.",
    {
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      group_by: z.enum(["tool", "action", "day"]).optional().default("tool")
        .describe("How to group the summary"),
    },
    async ({ date_from, date_to, group_by }) => {
      try {
        let query = `
          SELECT 
            tool_name,
            action,
            date(timestamp) as day,
            COUNT(*) as count,
            AVG(duration_ms) as avg_duration,
            MIN(duration_ms) as min_duration,
            MAX(duration_ms) as max_duration
          FROM logs 
          WHERE 1=1
        `;
        const params: any[] = [];

        if (date_from) {
          query += " AND date(timestamp) >= ?";
          params.push(date_from);
        }

        if (date_to) {
          query += " AND date(timestamp) <= ?";
          params.push(date_to);
        }

        // Group by specified field
        switch (group_by) {
          case "tool":
            query += " GROUP BY tool_name ORDER BY count DESC";
            break;
          case "action":
            query += " GROUP BY tool_name, action ORDER BY count DESC";
            break;
          case "day":
            query += " GROUP BY date(timestamp) ORDER BY day DESC";
            break;
        }

        const results = db.prepare(query).all(...params) as Array<{
          tool_name?: string;
          action?: string;
          day?: string;
          count: number;
          avg_duration?: number;
          min_duration?: number;
          max_duration?: number;
        }>;

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "No logs found for the specified period" }],
          };
        }

        let summary = `Log Summary (${group_by}):\n\n`;
        
        results.forEach(row => {
          const duration = row.avg_duration ? 
            ` (avg: ${Math.round(row.avg_duration)}ms, min: ${row.min_duration}ms, max: ${row.max_duration}ms)` : "";
          
          switch (group_by) {
            case "tool":
              summary += `${row.tool_name}: ${row.count} entries${duration}\n`;
              break;
            case "action":
              summary += `${row.tool_name}.${row.action}: ${row.count} entries${duration}\n`;
              break;
            case "day":
              summary += `${row.day}: ${row.count} entries${duration}\n`;
              break;
          }
        });

        return {
          content: [{ type: "text", text: summary }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "log_search",
    "Search logs by tool name, date range, or keyword.",
    {
      tool_name: z.string().optional().describe("Filter by tool name"),
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      keyword: z.string().optional().describe("Search keyword in action or summaries"),
      limit: z.number().optional().default(50).describe("Maximum results to return"),
    },
    async ({ tool_name, date_from, date_to, keyword, limit }) => {
      try {
        let query = `
          SELECT timestamp, tool_name, action, input_summary, output_summary, duration_ms
          FROM logs WHERE 1=1
        `;
        const params: any[] = [];

        if (tool_name) {
          query += " AND tool_name = ?";
          params.push(tool_name);
        }

        if (date_from) {
          query += " AND date(timestamp) >= ?";
          params.push(date_from);
        }

        if (date_to) {
          query += " AND date(timestamp) <= ?";
          params.push(date_to);
        }

        if (keyword) {
          query += " AND (action LIKE ? OR input_summary LIKE ? OR output_summary LIKE ?)";
          const searchTerm = `%${keyword}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        query += " ORDER BY timestamp DESC LIMIT ?";
        params.push(limit);

        const results = db.prepare(query).all(...params) as Array<{
          timestamp: string;
          tool_name: string;
          action: string;
          input_summary?: string;
          output_summary?: string;
          duration_ms?: number;
        }>;

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "No logs found matching criteria" }],
          };
        }

        const logEntries = results.map(row => {
          const duration = row.duration_ms ? ` (${row.duration_ms}ms)` : '';
          const input = row.input_summary ? ` | Input: ${row.input_summary}` : '';
          const output = row.output_summary ? ` | Output: ${row.output_summary}` : '';
          return `${row.timestamp} | ${row.tool_name}.${row.action}${duration}${input}${output}`;
        }).join('\n');

        return {
          content: [{ 
            type: "text", 
            text: `Found ${results.length} log entries:\n\n${logEntries}` 
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "log_export",
    "Export logs as JSON or CSV for analysis.",
    {
      format: z.enum(["json", "csv"]).describe("Export format"),
      tool_name: z.string().optional().describe("Filter by tool name"),
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().default(1000).describe("Maximum results to export"),
    },
    async ({ format, tool_name, date_from, date_to, limit }) => {
      try {
        let query = `
          SELECT timestamp, tool_name, action, input_summary, output_summary, duration_ms, metadata
          FROM logs WHERE 1=1
        `;
        const params: any[] = [];

        if (tool_name) {
          query += " AND tool_name = ?";
          params.push(tool_name);
        }

        if (date_from) {
          query += " AND date(timestamp) >= ?";
          params.push(date_from);
        }

        if (date_to) {
          query += " AND date(timestamp) <= ?";
          params.push(date_to);
        }

        query += " ORDER BY timestamp DESC LIMIT ?";
        params.push(limit);

        const results = db.prepare(query).all(...params);

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "No logs found to export" }],
          };
        }

        let exportContent: string;

        if (format === "json") {
          exportContent = JSON.stringify(results, null, 2);
        } else {
          // CSV format
          const headers = ["timestamp", "tool_name", "action", "input_summary", "output_summary", "duration_ms", "metadata"];
          const csvRows = [headers.join(",")];
          
          results.forEach((row: any) => {
            const values = headers.map(header => {
              const value = row[header] || '';
              return `"${value.toString().replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(","));
          });
          
          exportContent = csvRows.join("\n");
        }

        return {
          content: [{ 
            type: "text", 
            text: `Exported ${results.length} log entries as ${format.toUpperCase()}:\n\n${exportContent}` 
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
