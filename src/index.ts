#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKvTools } from "./tools/kv-store.js";
import { registerFormatTools } from "./tools/format-convert.js";
import { registerLogTools } from "./tools/agent-log.js";

const server = new McpServer(
  { name: "agentos-mcp", version: "1.0.0" },
  {
    instructions: `AgentOS provides essential operating system services for AI agents.
    
AVAILABLE CAPABILITIES:
- kv_set/kv_get/kv_delete/kv_list: Persistent key-value memory across sessions
- format_convert: Convert between file formats (MD, HTML, CSV, JSON, YAML, XML)
- log_action/log_search/log_export: Structured activity logging and audit trail

RECOMMENDED WORKFLOWS:
- "Remember something": kv_set with a descriptive key
- "What did I do earlier?": log_search with relevant keywords
- "Convert this data": format_convert with source format and target format`
  }
);

registerKvTools(server);
registerFormatTools(server);
registerLogTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentOS MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
