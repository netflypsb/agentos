import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";
import { AgentErrorFactory, ValidationUtils, withErrorHandling, ErrorCode } from "../errors.js";
import { builtInTemplates } from "./template-library.js";
import type { LicenseInfo } from "../license.js";

// In-memory loop detection store (fingerprint -> count)
const loopFingerprints = new Map<string, { count: number; lastSeen: number }>();

// Clean up old fingerprints every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loopFingerprints.entries()) {
    if (now - value.lastSeen > 300000) { // 5 minutes
      loopFingerprints.delete(key);
    }
  }
}, 300000);

export function registerBudgetGuardTools(server: McpServer, license: LicenseInfo) {
  server.tool(
    "budget_set",
    "Set a budget limit for a session or task to track resource usage.",
    {
      budget_id: z.string().describe("Unique budget identifier"),
      user_id: z.string().describe("User identifier"),
      max_tokens: z.number().optional().describe("Maximum token limit (optional)"),
      max_actions: z.number().optional().describe("Maximum action count limit (optional)"),
      max_cost_cents: z.number().optional().describe("Maximum cost in cents (optional)"),
      expires_minutes: z.number().optional().default(60).describe("Budget expiration time in minutes"),
      task_id: z.string().optional().describe("Optional associated task ID"),
    },
    withErrorHandling(async ({ budget_id, user_id, max_tokens, max_actions, max_cost_cents, expires_minutes, task_id }) => {
      const validatedBudgetId = ValidationUtils.validateString(budget_id, 1, 255);
      const validatedUserId = ValidationUtils.validateString(user_id, 1, 255);
      
      const expiresAt = Math.floor(Date.now() / 1000) + (expires_minutes * 60);
      
      try {
        db.prepare(`
          INSERT OR REPLACE INTO budgets (id, user_id, task_id, total_tokens, total_cost_cents, action_count, loop_detection, created_at, expires_at)
          VALUES (?, ?, ?, 0, 0, 0, '{}', unixepoch(), ?)
        `).run(validatedBudgetId, validatedUserId, task_id || null, expiresAt);

        const limits = [];
        if (max_tokens) limits.push(`${max_tokens} tokens`);
        if (max_actions) limits.push(`${max_actions} actions`);
        if (max_cost_cents) limits.push(`${max_cost_cents / 100} cost`);

        return {
          content: [{ 
            type: "text", 
            text: `Budget "${validatedBudgetId}" set for user ${validatedUserId}\nLimits: ${limits.join(', ') || 'none'}\nExpires in ${expires_minutes} minutes` 
          }],
        };
      } catch (error) {
        throw AgentErrorFactory.databaseError('budget_set', error as Error);
      }
    })
  );

  server.tool(
    "budget_check",
    "Check current budget usage and remaining limits.",
    {
      budget_id: z.string().describe("Budget identifier"),
    },
    withErrorHandling(async ({ budget_id }) => {
      const validatedBudgetId = ValidationUtils.validateString(budget_id, 1, 255);
      
      try {
        const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(validatedBudgetId) as {
          id: string;
          user_id: string;
          task_id: string | null;
          total_tokens: number;
          total_cost_cents: number;
          action_count: number;
          expires_at: number;
          loop_detection: string;
        } | undefined;

        if (!budget) {
          throw AgentErrorFactory.create(ErrorCode.KEY_NOT_FOUND, `Budget "${validatedBudgetId}" not found`);
        }

        const now = Math.floor(Date.now() / 1000);
        const isExpired = budget.expires_at < now;
        const remaining = Math.max(0, budget.expires_at - now);

        // Parse loop detection data
        const loopData = JSON.parse(budget.loop_detection || '{}') as { 
          fingerprints?: Record<string, number>;
          lastAlert?: number;
        };
        const suspiciousLoops = Object.entries(loopData.fingerprints || {})
          .filter(([_, count]) => count > 3)
          .map(([fp, count]) => `${fp.substring(0, 20)}... (${count}x)`);

        return {
          content: [{ 
            type: "text", 
            text: `Budget: ${budget.id}\nUser: ${budget.user_id}\nStatus: ${isExpired ? 'EXPIRED' : 'active'}\n\nUsage:\n- Actions: ${budget.action_count}\n- Tokens: ${budget.total_tokens}\n- Cost: ${(budget.total_cost_cents / 100).toFixed(2)}\n\nTime Remaining: ${Math.floor(remaining / 60)} minutes\n\n${suspiciousLoops.length > 0 ? `Loop Alerts:\n${suspiciousLoops.join('\n')}` : 'No loop patterns detected'}` 
          }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('budget_check', error as Error);
      }
    })
  );

  server.tool(
    "budget_consume",
    "Record resource consumption and check if budget is exceeded. Auto-detects loops.",
    {
      budget_id: z.string().describe("Budget identifier"),
      tokens: z.number().optional().default(0).describe("Tokens consumed"),
      cost_cents: z.number().optional().default(0).describe("Cost in cents"),
      action_fingerprint: z.string().optional().describe("Action fingerprint for loop detection (tool_name:params_hash)"),
    },
    withErrorHandling(async ({ budget_id, tokens, cost_cents, action_fingerprint }) => {
      const validatedBudgetId = ValidationUtils.validateString(budget_id, 1, 255);
      
      try {
        // Get current budget
        const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(validatedBudgetId) as {
          total_tokens: number;
          total_cost_cents: number;
          action_count: number;
          expires_at: number;
          loop_detection: string;
        } | undefined;

        if (!budget) {
          throw AgentErrorFactory.create(ErrorCode.KEY_NOT_FOUND, `Budget "${validatedBudgetId}" not found`);
        }

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (budget.expires_at < now) {
          throw AgentErrorFactory.create(ErrorCode.TTL_EXPIRED, `Budget "${validatedBudgetId}" has expired`);
        }

        // Loop detection
        let loopAlert = false;
        let loopData: { fingerprints: Record<string, number>; lastAlert?: number } = { 
          fingerprints: {} 
        };
        
        try {
          loopData = JSON.parse(budget.loop_detection || '{}');
        } catch {}

        if (action_fingerprint) {
          const fp = action_fingerprint;
          const currentCount = (loopData.fingerprints?.[fp] || 0) + 1;
          
          if (!loopData.fingerprints) {
            loopData.fingerprints = {};
          }
          loopData.fingerprints[fp] = currentCount;

          // Alert if pattern detected (> 5 repetitions)
          if (currentCount === 5) {
            loopAlert = true;
            loopData.lastAlert = Date.now();
          }

          // In-memory tracking for faster detection
          const memTrack = loopFingerprints.get(fp);
          if (memTrack) {
            memTrack.count++;
            memTrack.lastSeen = Date.now();
          } else {
            loopFingerprints.set(fp, { count: 1, lastSeen: Date.now() });
          }
        }

        // Update budget
        const newTokens = budget.total_tokens + tokens;
        const newCost = budget.total_cost_cents + cost_cents;
        const newActions = budget.action_count + 1;

        db.prepare(`
          UPDATE budgets 
          SET total_tokens = ?, total_cost_cents = ?, action_count = ?, loop_detection = ?
          WHERE id = ?
        `).run(newTokens, newCost, newActions, JSON.stringify(loopData), validatedBudgetId);

        let message = `Recorded consumption for budget ${validatedBudgetId}\n`;
        message += `- Actions: ${newActions}\n`;
        message += `- Tokens: ${newTokens} (+${tokens})\n`;
        message += `- Cost: ${(newCost / 100).toFixed(2)} (+${(cost_cents / 100).toFixed(2)})`;

        if (loopAlert) {
          message += `\n\n⚠️ LOOP DETECTED: Action pattern "${action_fingerprint}" repeated 5+ times`;
        }

        return {
          content: [{ type: "text", text: message }],
          isError: loopAlert, // Signal potential issue
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('budget_consume', error as Error);
      }
    })
  );
}
