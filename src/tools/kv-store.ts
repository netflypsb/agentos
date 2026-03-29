import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";
import { AgentErrorFactory, ValidationUtils, withErrorHandling, ErrorCode } from "../errors.js";

export function registerKvTools(server: McpServer) {
  server.tool(
    "kv_set",
    "Store a key-value pair in persistent local memory. " +
    "Supports namespaces for isolation and optional TTL for auto-expiry.",
    {
      key: z.string().describe("The key to store (alphanumeric, dot, underscore, hyphen, max 255 chars)"),
      value: z.string().describe("The value to store (string or JSON, max 1MB)"),
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation (alphanumeric, underscore, hyphen, max 50 chars)"),
      ttl_seconds: z.number().optional()
        .describe("Time-to-live in seconds (1-31536000, max 1 year)"),
    },
    withErrorHandling(async ({ key, value, namespace, ttl_seconds }) => {
      // Validate inputs
      const validatedKey = ValidationUtils.validateKey(key);
      const validatedNamespace = ValidationUtils.validateNamespace(namespace);
      const validatedValue = ValidationUtils.validateString(value, 0, 1048576); // 1MB limit
      
      let validatedTtl: number | null = null;
      if (ttl_seconds !== undefined) {
        validatedTtl = ValidationUtils.validateNumber(ttl_seconds, 1, 31536000); // Max 1 year
      }

      const ttl = validatedTtl 
        ? Math.floor(Date.now() / 1000) + validatedTtl 
        : null;

      try {
        db.prepare(`
          INSERT OR REPLACE INTO kv (namespace, key, value, ttl, created_at)
          VALUES (?, ?, ?, ?, unixepoch())
        `).run(validatedNamespace, validatedKey, validatedValue, ttl);

        const ttlMessage = validatedTtl ? ` (expires in ${validatedTtl}s)` : "";
        return {
          content: [{ 
            type: "text", 
            text: `Stored "${validatedKey}" in namespace "${validatedNamespace}"${ttlMessage}` 
          }],
        };
      } catch (error) {
        throw AgentErrorFactory.databaseError('kv_set', error as Error);
      }
    })
  );

  server.tool(
    "kv_get",
    "Retrieve a value by key from persistent local memory.",
    {
      key: z.string().describe("The key to retrieve"),
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
    },
    withErrorHandling(async ({ key, namespace }) => {
      // Validate inputs
      const validatedKey = ValidationUtils.validateKey(key);
      const validatedNamespace = ValidationUtils.validateNamespace(namespace);

      try {
        const result = db.prepare(`
          SELECT value, ttl FROM kv WHERE namespace = ? AND key = ?
        `).get(validatedNamespace, validatedKey) as { value: string; ttl?: number } | undefined;

        if (!result) {
          throw AgentErrorFactory.create(
            ErrorCode.KEY_NOT_FOUND,
            `Key "${validatedKey}" not found in namespace "${validatedNamespace}"`
          );
        }

        // Check TTL
        if (result.ttl && result.ttl < Math.floor(Date.now() / 1000)) {
          // Clean up expired key
          db.prepare("DELETE FROM kv WHERE namespace = ? AND key = ?")
            .run(validatedNamespace, validatedKey);
          
          throw AgentErrorFactory.create(
            ErrorCode.TTL_EXPIRED,
            `Key "${validatedKey}" expired and was removed`
          );
        }

        return {
          content: [{ type: "text", text: result.value }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error; // Re-throw AgentError
        }
        throw AgentErrorFactory.databaseError('kv_get', error as Error);
      }
    })
  );

  server.tool(
    "kv_delete",
    "Remove a key-value pair from persistent local memory.",
    {
      key: z.string().describe("The key to delete"),
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
    },
    withErrorHandling(async ({ key, namespace }) => {
      // Validate inputs
      const validatedKey = ValidationUtils.validateKey(key);
      const validatedNamespace = ValidationUtils.validateNamespace(namespace);

      try {
        const result = db.prepare(`
          DELETE FROM kv WHERE namespace = ? AND key = ?
        `).run(validatedNamespace, validatedKey);

        if (result.changes === 0) {
          throw AgentErrorFactory.create(
            ErrorCode.KEY_NOT_FOUND,
            `Key "${validatedKey}" not found in namespace "${validatedNamespace}"`
          );
        }

        return {
          content: [{ type: "text", text: `Deleted "${validatedKey}" from namespace "${validatedNamespace}"` }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error; // Re-throw AgentError
        }
        throw AgentErrorFactory.databaseError('kv_delete', error as Error);
      }
    })
  );

  server.tool(
    "kv_list",
    "List keys in a namespace with optional prefix filter.",
    {
      namespace: z.string().optional().default("default")
        .describe("Namespace for key isolation"),
      prefix: z.string().optional()
        .describe("Filter keys by prefix (alphanumeric, max 50 chars)"),
      limit: z.number().optional().default(100)
        .describe("Maximum keys to return (1-1000)"),
    },
    withErrorHandling(async ({ namespace, prefix, limit }) => {
      // Validate inputs
      const validatedNamespace = ValidationUtils.validateNamespace(namespace);
      const validatedLimit = ValidationUtils.validateNumber(limit, 1, 1000);
      
      let validatedPrefix: string | undefined;
      if (prefix !== undefined) {
        validatedPrefix = ValidationUtils.validateString(prefix, 0, 50);
      }

      try {
        let query = `
          SELECT key, created_at, ttl FROM kv 
          WHERE namespace = ? 
          AND (ttl IS NULL OR ttl > ?)
        `;
        const params: any[] = [validatedNamespace, Math.floor(Date.now() / 1000)];

        if (validatedPrefix) {
          query += " AND key LIKE ?";
          params.push(validatedPrefix + "%");
        }

        query += " ORDER BY key LIMIT ?";
        params.push(validatedLimit);

        const results = db.prepare(query).all(...params) as Array<{
          key: string;
          created_at: number;
          ttl?: number;
        }>;

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: `No keys found in namespace "${validatedNamespace}"` }],
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
            text: `Keys in namespace "${validatedNamespace}":\n${keyList}` 
          }],
        };
      } catch (error) {
        throw AgentErrorFactory.databaseError('kv_list', error as Error);
      }
    })
  );
}
