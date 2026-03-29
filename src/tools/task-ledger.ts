import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";
import { AgentErrorFactory, ValidationUtils, withErrorHandling, ErrorCode } from "../errors.js";
import type { LicenseInfo } from "../license.js";

export function registerTaskLedgerTools(server: McpServer, _license: LicenseInfo) {
  server.tool(
    "task_create",
    "Create a new task with initial state for tracking progress across sessions.",
    {
      session_id: z.string().describe("Unique session identifier for task grouping"),
      initial_state: z.string().optional().describe("JSON-encoded initial state data"),
    },
    withErrorHandling(async ({ session_id, initial_state }) => {
      const validatedSessionId = ValidationUtils.validateString(session_id, 1, 255);
      
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const stateData = initial_state || '{}';
      
      try {
        db.prepare(`
          INSERT INTO tasks (id, session_id, status, state_data, checkpoints, created_at, updated_at)
          VALUES (?, ?, 'created', ?, '[]', unixepoch(), unixepoch())
        `).run(taskId, validatedSessionId, stateData);

        return {
          content: [{ 
            type: "text", 
            text: `Task created: ${taskId}\nSession: ${validatedSessionId}\nStatus: created` 
          }],
        };
      } catch (error) {
        throw AgentErrorFactory.databaseError('task_create', error as Error);
      }
    })
  );

  server.tool(
    "task_checkpoint",
    "Save a checkpoint for an active task to preserve current state.",
    {
      task_id: z.string().describe("Task identifier from task_create"),
      checkpoint_name: z.string().describe("Name for this checkpoint"),
      state_delta: z.string().describe("JSON-encoded state changes to apply"),
    },
    withErrorHandling(async ({ task_id, checkpoint_name, state_delta }) => {
      const validatedTaskId = ValidationUtils.validateString(task_id, 1, 255);
      const validatedName = ValidationUtils.validateString(checkpoint_name, 1, 100);
      
      try {
        const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(validatedTaskId) as {
          id: string;
          state_data: string;
          checkpoints: string;
          status: string;
        } | undefined;

        if (!task) {
          throw AgentErrorFactory.create(ErrorCode.TASK_NOT_FOUND, `Task "${validatedTaskId}" not found`);
        }

        if (task.status === 'completed') {
          throw AgentErrorFactory.create(ErrorCode.TASK_COMPLETED, `Task "${validatedTaskId}" is already completed`);
        }

        const currentState = JSON.parse(task.state_data || '{}');
        const delta = JSON.parse(state_delta);
        const newState = { ...currentState, ...delta };
        
        const checkpoints = JSON.parse(task.checkpoints || '[]');
        checkpoints.push({
          name: validatedName,
          timestamp: Date.now(),
          state_snapshot: newState
        });

        db.prepare(`
          UPDATE tasks 
          SET state_data = ?, checkpoints = ?, updated_at = unixepoch(), status = 'active'
          WHERE id = ?
        `).run(JSON.stringify(newState), JSON.stringify(checkpoints), validatedTaskId);

        return {
          content: [{ 
            type: "text", 
            text: `Checkpoint "${validatedName}" saved for task ${validatedTaskId}\nCheckpoint #${checkpoints.length}` 
          }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('task_checkpoint', error as Error);
      }
    })
  );

  server.tool(
    "task_rollback",
    "Rollback a task to a previous checkpoint.",
    {
      task_id: z.string().describe("Task identifier"),
      checkpoint_index: z.number().optional().describe("Checkpoint index to rollback to (default: previous)"),
    },
    withErrorHandling(async ({ task_id, checkpoint_index }) => {
      const validatedTaskId = ValidationUtils.validateString(task_id, 1, 255);
      
      try {
        const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(validatedTaskId) as {
          id: string;
          state_data: string;
          checkpoints: string;
        } | undefined;

        if (!task) {
          throw AgentErrorFactory.create(ErrorCode.TASK_NOT_FOUND, `Task "${validatedTaskId}" not found`);
        }

        const checkpoints = JSON.parse(task.checkpoints || '[]') as Array<{name: string; timestamp: number; state_snapshot: unknown}>;
        
        if (checkpoints.length === 0) {
          throw AgentErrorFactory.create(ErrorCode.NO_CHECKPOINTS, `No checkpoints available for task "${validatedTaskId}"`);
        }

        const targetIndex = checkpoint_index !== undefined ? checkpoint_index : checkpoints.length - 2;
        if (targetIndex < 0 || targetIndex >= checkpoints.length) {
          throw AgentErrorFactory.create(ErrorCode.INVALID_CHECKPOINT, `Invalid checkpoint index ${targetIndex}`);
        }

        const targetCheckpoint = checkpoints[targetIndex];
        const trimmedCheckpoints = checkpoints.slice(0, targetIndex + 1);

        db.prepare(`
          UPDATE tasks 
          SET state_data = ?, checkpoints = ?, updated_at = unixepoch(), status = 'active'
          WHERE id = ?
        `).run(JSON.stringify(targetCheckpoint.state_snapshot), JSON.stringify(trimmedCheckpoints), validatedTaskId);

        return {
          content: [{ 
            type: "text", 
            text: `Rolled back task ${validatedTaskId} to checkpoint "${targetCheckpoint.name}" (${targetIndex + 1}/${checkpoints.length})` 
          }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('task_rollback', error as Error);
      }
    })
  );

  server.tool(
    "task_status",
    "Get current status and state of a task.",
    {
      task_id: z.string().describe("Task identifier"),
    },
    withErrorHandling(async ({ task_id }) => {
      const validatedTaskId = ValidationUtils.validateString(task_id, 1, 255);
      
      try {
        const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(validatedTaskId) as {
          id: string;
          session_id: string;
          status: string;
          state_data: string;
          checkpoints: string;
          created_at: number;
          updated_at: number;
        } | undefined;

        if (!task) {
          throw AgentErrorFactory.create(ErrorCode.TASK_NOT_FOUND, `Task "${validatedTaskId}" not found`);
        }

        const checkpoints = JSON.parse(task.checkpoints || '[]') as Array<{name: string; timestamp: number}>;
        const state = JSON.parse(task.state_data || '{}');

        return {
          content: [{ 
            type: "text", 
            text: `Task: ${task.id}\nSession: ${task.session_id}\nStatus: ${task.status}\nCheckpoints: ${checkpoints.length}\nLast Updated: ${new Date(task.updated_at * 1000).toISOString()}\n\nState:\n${JSON.stringify(state, null, 2)}` 
          }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('task_status', error as Error);
      }
    })
  );

  server.tool(
    "task_list",
    "List all tasks for a session with optional status filter.",
    {
      session_id: z.string().describe("Session identifier"),
      status: z.enum(["created", "active", "completed", "all"]).optional().default("all")
        .describe("Filter by task status"),
    },
    withErrorHandling(async ({ session_id, status }) => {
      const validatedSessionId = ValidationUtils.validateString(session_id, 1, 255);
      
      try {
        let query = "SELECT id, status, created_at, updated_at FROM tasks WHERE session_id = ?";
        const params: (string | number)[] = [validatedSessionId];

        if (status !== 'all') {
          query += " AND status = ?";
          params.push(status);
        }

        query += " ORDER BY updated_at DESC";

        const tasks = db.prepare(query).all(...params) as Array<{
          id: string;
          status: string;
          created_at: number;
          updated_at: number;
        }>;

        if (tasks.length === 0) {
          return {
            content: [{ type: "text", text: `No tasks found for session "${validatedSessionId}"` }],
          };
        }

        const taskList = tasks.map(t => 
          `- ${t.id} [${t.status}] (updated: ${new Date(t.updated_at * 1000).toLocaleDateString()})`
        ).join('\n');

        return {
          content: [{ 
            type: "text", 
            text: `Tasks for session "${validatedSessionId}":\n${taskList}` 
          }],
        };
      } catch (error) {
        throw AgentErrorFactory.databaseError('task_list', error as Error);
      }
    })
  );

  server.tool(
    "task_complete",
    "Mark a task as completed with final state.",
    {
      task_id: z.string().describe("Task identifier"),
      final_state: z.string().optional().describe("JSON-encoded final state data"),
    },
    withErrorHandling(async ({ task_id, final_state }) => {
      const validatedTaskId = ValidationUtils.validateString(task_id, 1, 255);
      
      try {
        const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(validatedTaskId) as {
          id: string;
          state_data: string;
        } | undefined;

        if (!task) {
          throw AgentErrorFactory.create(ErrorCode.TASK_NOT_FOUND, `Task "${validatedTaskId}" not found`);
        }

        const finalState = final_state || task.state_data;

        db.prepare(`
          UPDATE tasks 
          SET status = 'completed', state_data = ?, updated_at = unixepoch()
          WHERE id = ?
        `).run(finalState, validatedTaskId);

        return {
          content: [{ 
            type: "text", 
            text: `Task ${validatedTaskId} marked as completed` 
          }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('task_complete', error as Error);
      }
    })
  );
}
