#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKvTools } from "./tools/kv-store.js";
import { registerFormatTools } from "./tools/format-convert.js";
import { registerLogTools } from "./tools/agent-log.js";
import { registerTaskLedgerTools } from "./tools/task-ledger.js";
import { registerBudgetGuardTools } from "./tools/budget-guard.js";
import { registerTemplateEngineTools } from "./tools/template-engine.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerSupportTools } from "./support.js";

const server = new McpServer(
  { name: "agentos-mcp", version: "1.0.0" },
  {
    instructions: `AgentOS provides essential operating system services for AI agents.
    
AVAILABLE CAPABILITIES:
- kv_set/kv_get/kv_delete/kv_list: Persistent key-value memory across sessions
- format_convert: Convert between file formats (MD, HTML, CSV, JSON, YAML, XML)
- log_action/log_search/log_export: Structured activity logging and audit trail
- task_create/task_checkpoint/task_rollback/task_status/task_list/task_complete: Task state management
- budget_set/budget_check/budget_consume: Resource tracking and loop detection
- template_list/template_render/template_create: Jinja2-style templating with built-in library
- analytics_dashboard/analytics_report: Usage analytics and monitoring
- support_create_ticket/support_ticket_status/support_list_tickets/support_knowledge_base: Customer support

RECOMMENDED WORKFLOWS:
- "Remember something": kv_set with a descriptive key
- "What did I do earlier?": log_search with relevant keywords
- "Convert this data": format_convert with source format and target format
- "Track this task": task_create with session_id
- "Check my budget": budget_check with budget_id
- "Generate a meeting notes": template_render with meeting_notes template
- "View usage stats": analytics_dashboard
- "Get help": support_knowledge_base or support_create_ticket`
  }
);

registerKvTools(server);
registerFormatTools(server);
registerLogTools(server);
registerTaskLedgerTools(server);
registerBudgetGuardTools(server);
registerTemplateEngineTools(server);
registerAnalyticsTools(server);
registerSupportTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentOS MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
