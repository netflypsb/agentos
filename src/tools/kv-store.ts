import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";

export function registerKvTools(server: McpServer) {
  server.tool(
    "kv_set",
    "Store a key-value pair in persistent local memory. " +
    "Supports namespaces for isolation and optional TTL for auto-expiry.",
    {
      key: z.string().describe("The key to store"),
      value: z.string().describe("The value to store (string or JSON)"),
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
      ttl_seconds: z.number().optional()
        .describe("Time-to-live in seconds. Omit for permanent storage."),
    },
    async ({ key, value, namespace, ttl_seconds }) => {
      try {
        const ttl = ttl_seconds 
          ? Math.floor(Date.now() / 1000) + ttl_seconds 
          : null;
        db.prepare(`
          INSERT OR REPLACE INTO kv (namespace, key, value, ttl, created_at)
          VALUES (?, ?, ?, ?, unixepoch())
        `).run(namespace, key, value, ttl);
        return {
          content: [{ 
            type: "text", 
            text: `Stored "${key}" in namespace "${namespace}"` +
              (ttl_seconds ? ` (expires in ${ttl_seconds}s)` : "") 
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
    "kv_get",
    "Retrieve a value by key from persistent local memory.",
    {
      key: z.string().describe("The key to retrieve"),
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
    },
    async ({ key, namespace }) => {
      try {
        const result = db.prepare(`
          SELECT value, ttl FROM kv WHERE namespace = ? AND key = ?
        `).get(namespace, key) as { value: string; ttl?: number } | undefined;

        if (!result) {
          return {
            content: [{ type: "text", text: `Key "${key}" not found in namespace "${namespace}"` }],
          };
        }

        // Check TTL
        if (result.ttl && result.ttl < Math.floor(Date.now() / 1000)) {
          db.prepare("DELETE FROM kv WHERE namespace = ? AND key = ?").run(namespace, key);
          return {
            content: [{ type: "text", text: `Key "${key}" not found in namespace "${namespace}"` }],
          };
        }

        return {
          content: [{ type: "text", text: result.value }],
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
    "kv_delete",
    "Remove a key-value pair from persistent local memory.",
    {
      key: z.string().describe("The key to delete"),
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
    },
    async ({ key, namespace }) => {
      try {
        const result = db.prepare(`
          DELETE FROM kv WHERE namespace = ? AND key = ?
        `).run(namespace, key);

        if (result.changes === 0) {
          return {
            content: [{ type: "text", text: `Key "${key}" not found in namespace "${namespace}"` }],
          };
        }

        return {
          content: [{ type: "text", text: `Deleted "${key}" from namespace "${namespace}"` }],
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
    "kv_list",
    "List keys in a namespace with optional prefix filter.",
    {
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
      prefix: z.string().optional()
        .describe("Filter keys by prefix (optional)"),
    },
    async ({ namespace, prefix }) => {
      try {
        let query = `
          SELECT key, created_at, ttl FROM kv 
          WHERE namespace = ? 
          AND (ttl IS NULL OR ttl > ?)
        `;
        const params: any[] = [namespace, Math.floor(Date.now() / 1000)];

        if (prefix) {
          query += " AND key LIKE ?";
          params.push(prefix + "%");
        }

        query += " ORDER BY key";

        const results = db.prepare(query).all(...params) as Array<{
          key: string;
          created_at: number;
          ttl?: number;
        }>;

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: `No keys found in namespace "${namespace}"` }],
          };
        }

        const keyList = results.map(row => {
          const ttlInfo = row.ttl ? 
            ` (expires in ${Math.max(0, row.ttl - Math.floor(Date.now() / 1000))}s)` : 
            "";
          return `- ${row.key}${ttlInfo}`;
        }).join("\n");

        return {
          content: [{ 
            type: "text", 
            text: `Keys in namespace "${namespace}":\n${keyList}` 
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
