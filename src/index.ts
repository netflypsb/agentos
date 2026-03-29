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
import { registerMonitoringTools } from "./monitoring.js";
import { LicenseManager, LicenseTier } from "./license.js";

// Validate license on startup
const licenseKey = process.env.MCP_LICENSE_KEY;
const license = await LicenseManager.validateLicense(licenseKey);

console.error(`AgentOS MCP Server Starting...`);
console.error(`License Tier: ${license.tier}${license.isValid ? '' : ' (invalid)'}`);

const server = new McpServer(
  { name: "agentos-mcp", version: "1.0.0" },
  {
    instructions: `AgentOS provides essential operating system services for AI agents.

YOUR LICENSE: ${license.tier.toUpperCase()}
${license.tier === LicenseTier.FREE ? 'Upgrade at https://mcp-marketplace.io/agentos' : ''}

AVAILABLE CAPABILITIES:
- kv_set/kv_get/kv_delete/kv_list: Persistent key-value memory across sessions
- format_convert: Convert between file formats (MD, HTML, CSV, JSON, YAML, XML)
- log_action/log_search/log_export: Structured activity logging and audit trail
${license.tier !== LicenseTier.FREE ? '- task_create/task_checkpoint/task_rollback/task_status/task_list/task_complete: Task state management' : ''}
${license.tier !== LicenseTier.FREE ? '- budget_set/budget_check/budget_consume: Resource tracking and loop detection' : ''}
${license.tier !== LicenseTier.FREE ? '- template_list/template_render/template_create: Jinja2-style templating with built-in library' : ''}
${license.tier !== LicenseTier.FREE ? '- analytics_dashboard/analytics_report: Usage analytics and monitoring' : ''}
${license.tier !== LicenseTier.FREE ? '- support_create_ticket/support_ticket_status/support_list_tickets/support_knowledge_base: Customer support' : ''}
${license.tier !== LicenseTier.FREE ? '- monitoring_record_metric/monitoring_get_metrics: Real-time performance monitoring' : ''}
${license.tier !== LicenseTier.FREE ? '- monitoring_get_alerts/monitoring_acknowledge_alert: Alert management' : ''}
${license.tier !== LicenseTier.FREE ? '- monitoring_business_report: Business intelligence reports' : ''}
${license.tier !== LicenseTier.FREE ? '- monitoring_capacity_analysis: Capacity planning and scaling recommendations' : ''}
${license.tier !== LicenseTier.FREE ? '- monitoring_system_status: Overall system health' : ''}
${license.tier === LicenseTier.TEAM || license.tier === LicenseTier.ENTERPRISE ? '- workspace_create/workspace_manage: Team workspace management' : ''}
${license.tier === LicenseTier.ENTERPRISE ? '- audit_logs_export: Compliance audit trails' : ''}

RECOMMENDED WORKFLOWS:
- "Remember something": kv_set with a descriptive key
- "What did I do earlier?": log_search with relevant keywords
- "Convert this data": format_convert with source format and target format
${license.tier !== LicenseTier.FREE ? '- "Track this task": task_create with session_id' : ''}
${license.tier !== LicenseTier.FREE ? '- "Check my budget": budget_check with budget_id' : ''}
${license.tier !== LicenseTier.FREE ? '- "Generate a meeting notes": template_render with meeting_notes template' : ''}
${license.tier !== LicenseTier.FREE ? '- "View usage stats": analytics_dashboard' : ''}
${license.tier !== LicenseTier.FREE ? '- "Get help": support_knowledge_base or support_create_ticket' : ''}
${license.tier !== LicenseTier.FREE ? '- "Record metric": monitoring_record_metric' : ''}
${license.tier !== LicenseTier.FREE ? '- "View alerts": monitoring_get_alerts' : ''}`
  }
);

// Always register free tools
registerKvTools(server);
registerFormatTools(server);
registerLogTools(server, license);

// Register paid tools based on license tier
if (license.tier !== LicenseTier.FREE) {
  registerTaskLedgerTools(server, license);
  registerBudgetGuardTools(server, license);
  registerTemplateEngineTools(server, license);
  registerAnalyticsTools(server, license);
  registerSupportTools(server, license);
  registerMonitoringTools(server, license);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentOS MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
