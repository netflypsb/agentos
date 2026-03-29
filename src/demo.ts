#!/usr/bin/env node

// Demo version of AgentOS MCP server
// This shows the structure without external dependencies

console.log("AgentOS MCP Server Demo");
console.log("=======================");

// Mock MCP Server interface
interface MockMCPServer {
  tool(name: string, description: string, schema: any, handler: Function): void;
}

// Mock server implementation
const server: MockMCPServer = {
  tool: (name: string, description: string, schema: any, handler: Function) => {
    console.log(`\n📦 Tool: ${name}`);
    console.log(`   ${description}`);
    console.log(`   Schema: ${JSON.stringify(schema, null, 2)}`);
  }
};

// Mock Zod schema (simplified)
const z = {
  string: () => ({ 
    describe: (desc: string) => ({ 
      type: 'string', 
      description: desc,
      optional: () => ({ default: (value: any) => ({ default: value }) }),
      default: (value: any) => ({ default: value })
    })
  }),
  number: () => ({ 
    describe: (desc: string) => ({ 
      type: 'number', 
      description: desc,
      optional: () => ({ default: (value: any) => ({ default: value }) }),
      default: (value: any) => ({ default: value })
    })
  }),
  enum: (values: string[]) => ({ 
    describe: (desc: string) => ({ enum: values, description: desc }) 
  })
};

// Mock database
const mockDB = {
  tables: new Map(),
  exec: (sql: string) => console.log(`🗄️  Executing: ${sql}`),
  prepare: (sql: string) => ({
    run: (...args: any[]) => ({ changes: 1, lastInsertRowid: 1 }),
    get: (...args: any[]) => undefined,
    all: (...args: any[]) => []
  })
};

// KV Store Tools
function registerKvTools(server: MockMCPServer) {
  server.tool(
    "kv_set",
    "Store a key-value pair in persistent local memory with optional TTL and namespace.",
    {
      key: z.string().describe("The key to store"),
      value: z.string().describe("The value to store (string or JSON)"),
      namespace: z.string().describe("Namespace for key isolation").default("default"),
      ttl_seconds: z.number().describe("Time-to-live in seconds").optional(),
    },
    async ({ key, value, namespace, ttl_seconds }) => {
      console.log(`🔑 Storing: ${key} = ${value} (namespace: ${namespace})`);
      return { content: [{ type: "text", text: `Stored "${key}" in namespace "${namespace}"` }] };
    }
  );

  server.tool(
    "kv_get",
    "Retrieve a value by key from persistent local memory.",
    {
      key: z.string().describe("The key to retrieve"),
      namespace: z.string().optional().default("default").describe("Namespace for key isolation"),
    },
    async ({ key, namespace }) => {
      console.log(`🔑 Retrieving: ${key} (namespace: ${namespace})`);
      return { content: [{ type: "text", text: `Value for "${key}"` }] };
    }
  );
}

// Format Converter Tools
function registerFormatTools(server: MockMCPServer) {
  server.tool(
    "format_convert",
    "Convert between file formats locally. Supports MD↔HTML, CSV↔JSON, YAML↔JSON, XML→JSON.",
    {
      input_format: z.enum(["md", "html", "csv", "json", "yaml", "xml"]).describe("Source format"),
      output_format: z.enum(["md", "html", "csv", "json", "yaml", "xml"]).describe("Target format"),
      content: z.string().describe("Content to convert"),
    },
    async ({ input_format, output_format, content }) => {
      console.log(`🔄 Converting: ${input_format} → ${output_format}`);
      return { 
        content: [{ 
          type: "text", 
          text: `Converted from ${input_format} to ${output_format}` 
        }] 
      };
    }
  );
}

// Agent Log Tools
function registerLogTools(server: MockMCPServer) {
  server.tool(
    "log_action",
    "Append a structured log entry for debugging and audit trail.",
    {
      tool_name: z.string().describe("Name of the tool being logged"),
      action: z.string().describe("Action being performed"),
      input_summary: z.string().optional().describe("Brief summary of input"),
      output_summary: z.string().optional().describe("Brief summary of output"),
    },
    async ({ tool_name, action, input_summary, output_summary }) => {
      console.log(`📝 Logging: ${tool_name}.${action}`);
      return { 
        content: [{ 
          type: "text", 
          text: `Logged action: ${tool_name}.${action}` 
        }] 
      };
    }
  );
}

// Register all tools
console.log("\n🚀 Registering AgentOS Tools:");
registerKvTools(server);
registerFormatTools(server);
registerLogTools(server);

// Show server info
console.log("\n📋 Server Information:");
console.log("   Name: agentos-mcp");
console.log("   Version: 1.0.0");
console.log("   Type: MCP Server");
console.log("   Database: SQLite (mocked for demo)");

console.log("\n✅ AgentOS Demo Complete!");
console.log("\nNext Steps:");
console.log("1. Install dependencies: npm install");
console.log("2. Build the project: npm run build");
console.log("3. Test with MCP Inspector");
console.log("4. Deploy to MCP Marketplace");

process.exit(0);
