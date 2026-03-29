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
  tool: (_name: string, _description: string, _schema: any, _handler: Function) => {
    console.log(`\n📦 Tool: ${_name}`);
    console.log(`   ${_description}`);
    console.log(`   Schema: ${JSON.stringify(_schema, null, 2)}`);
  }
};

// Mock Zod schema (simplified)
const z = {
  string: () => {
    const createDescribe = (base: any) => (desc: string) => ({ ...base, description: desc });
    const base = {
      type: 'string',
      description: '',
    };
    return {
      describe: createDescribe(base),
      optional: () => {
        const optionalBase = { ...base, isOptional: true };
        return { ...optionalBase, describe: createDescribe(optionalBase) };
      },
      default: (value: unknown) => {
        const defaultBase = { ...base, defaultValue: value };
        return { ...defaultBase, describe: createDescribe(defaultBase) };
      }
    };
  },
  number: () => {
    const createDescribe = (base: any) => (desc: string) => ({ ...base, description: desc });
    const base = {
      type: 'number',
      description: '',
    };
    return {
      describe: createDescribe(base),
      optional: () => {
        const optionalBase = { ...base, isOptional: true };
        return { ...optionalBase, describe: createDescribe(optionalBase) };
      },
      default: (value: unknown) => {
        const defaultBase = { ...base, defaultValue: value };
        return { ...defaultBase, describe: createDescribe(defaultBase) };
      }
    };
  },
  enum: (values: string[]) => ({
    type: 'enum',
    enum: values,
    describe: (_desc: string) => ({ type: 'enum', enum: values, description: _desc })
  })
};

// Mock database
const _mockDB = {
  tables: new Map(),
  exec: (_sql: string) => console.log(`🗄️  Executing: ${_sql}`),
  prepare: (_sql: string) => ({
    run: (..._args: any[]) => ({ changes: 1, lastInsertRowid: 1 }),
    get: (..._args: any[]) => undefined,
    all: (..._args: any[]) => []
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
    async ({ key, value, namespace, ttl_seconds }: { key: string; value: string; namespace: string; ttl_seconds?: number }) => {
      console.log(`🔑 Storing: ${key} = ${value} (namespace: ${namespace}, ttl: ${ttl_seconds})`);
      return { content: [{ type: "text", text: `Stored "${key}" in namespace "${namespace}"` }] };
    }
  );

  server.tool(
    "kv_get",
    "Retrieve a value by key from persistent local memory.",
    {
      key: z.string().describe("The key to retrieve"),
      namespace: z.string().describe("Namespace for key isolation").optional().default("default"),
    },
    async ({ key, namespace }: { key: string; namespace: string }) => {
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
    async ({ input_format, output_format, content }: { input_format: string; output_format: string; content: string }) => {
      console.log(`🔄 Converting: ${input_format} → ${output_format} (${content.length} chars)`);
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
    async ({ tool_name, action, input_summary, output_summary }: { 
      tool_name: string; 
      action: string; 
      input_summary?: string; 
      output_summary?: string;
    }) => {
      console.log(`📝 Logging: ${tool_name}.${action} (input: ${input_summary || 'none'}, output: ${output_summary || 'none'})`);
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
