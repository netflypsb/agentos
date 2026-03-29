# AgentOS API Documentation

## Overview

AgentOS provides essential operating system services for AI agents through the Model Context Protocol (MCP). This document describes the complete API interface.

## Base URL and Connection

AgentOS runs as an MCP server. Connect using your MCP client configuration:

```json
{
  "mcpServers": {
    "agentos": {
      "command": "npx",
      "args": ["-y", "agentos-mcp"]
    }
  }
}
```

## Authentication

### Free Tier
- No authentication required
- Limited to 100 log entries per day
- All basic tools available

### Pro Tier ($12/month)
- Requires license key from MCP Marketplace
- Unlimited logging and advanced features
- Set `AGENTOS_LICENSE_KEY` environment variable

## Tools Reference

### KV Store Tools

#### `kv_set`
Store a key-value pair in persistent local memory.

**Parameters:**
- `key` (string, required): The key to store (alphanumeric, dot, underscore, hyphen, max 255 chars)
- `value` (string, required): The value to store (string or JSON, max 1MB)
- `namespace` (string, optional): Namespace for key isolation (default: "default")
- `ttl_seconds` (number, optional): Time-to-live in seconds (1-31536000, max 1 year)

**Example:**
```json
{
  "tool": "kv_set",
  "arguments": {
    "key": "user_preference_theme",
    "value": "dark",
    "namespace": "user_settings",
    "ttl_seconds": 86400
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Stored \"user_preference_theme\" in namespace \"user_settings\" (expires in 86400s)"
    }
  ]
}
```

#### `kv_get`
Retrieve a value by key from persistent local memory.

**Parameters:**
- `key` (string, required): The key to retrieve
- `namespace` (string, optional): Namespace for key isolation (default: "default")

**Example:**
```json
{
  "tool": "kv_get",
  "arguments": {
    "key": "user_preference_theme",
    "namespace": "user_settings"
  }
}
```

#### `kv_delete`
Remove a key-value pair from persistent local memory.

**Parameters:**
- `key` (string, required): The key to delete
- `namespace` (string, optional): Namespace for key isolation (default: "default")

#### `kv_list`
List keys in a namespace with optional prefix filter.

**Parameters:**
- `namespace` (string, optional): Namespace for key isolation (default: "default")
- `prefix` (string, optional): Filter keys by prefix (max 50 chars)
- `limit` (number, optional): Maximum keys to return (1-1000, default: 100)

### Format Converter Tools

#### `format_convert`
Convert between file formats locally.

**Parameters:**
- `input_format` (enum, required): Source format ("md", "html", "csv", "json", "yaml", "xml")
- `output_format` (enum, required): Target format ("md", "html", "csv", "json", "yaml", "xml")
- `content` (string, required): Content to convert

**Supported Conversions:**
- Markdown ↔ HTML
- CSV ↔ JSON
- YAML ↔ JSON
- XML → JSON
- Plaintext → Structured Markdown

**Example:**
```json
{
  "tool": "format_convert",
  "arguments": {
    "input_format": "csv",
    "output_format": "json",
    "content": "name,age,city\nJohn,30,NYC\nJane,25,LA"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Converted from csv to json:\n\n[{\"name\":\"John\",\"age\":\"30\",\"city\":\"NYC\"},{\"name\":\"Jane\",\"age\":\"25\",\"city\":\"LA\"}]"
    }
  ]
}
```

### Agent Log Tools

#### `log_action`
Append a structured log entry for debugging and audit trail.

**Parameters:**
- `tool_name` (string, required): Name of the tool being logged
- `action` (string, required): Action being performed
- `input_summary` (string, optional): Brief summary of input
- `output_summary` (string, optional): Brief summary of output
- `duration_ms` (number, optional): Duration in milliseconds
- `metadata` (string, optional): Additional metadata as JSON

**Example:**
```json
{
  "tool": "log_action",
  "arguments": {
    "tool_name": "kv_store",
    "action": "set",
    "input_summary": "key=user_id, value=12345",
    "duration_ms": 12
  }
}
```

#### `log_search`
Search logs by tool name, date range, or keyword.

**Parameters:**
- `tool_name` (string, optional): Filter by tool name
- `date_from` (string, optional): Start date (YYYY-MM-DD)
- `date_to` (string, optional): End date (YYYY-MM-DD)
- `keyword` (string, optional): Search keyword in action or summaries
- `limit` (number, optional): Maximum results to return (default: 50)

#### `log_summary`
Get a summary of log activity for a time period.

**Parameters:**
- `date_from` (string, optional): Start date (YYYY-MM-DD)
- `date_to` (string, optional): End date (YYYY-MM-DD)
- `group_by` (enum, optional): How to group the summary ("tool", "action", "day", default: "tool")

#### `log_export`
Export logs as JSON or CSV for analysis.

**Parameters:**
- `format` (enum, required): Export format ("json", "csv")
- `tool_name` (string, optional): Filter by tool name
- `date_from` (string, optional): Start date (YYYY-MM-DD)
- `date_to` (string, optional): End date (YYYY-MM-DD)
- `limit` (number, optional): Maximum results to export (default: 1000)

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "[E1201] Key 'invalid_key' not found in namespace 'default'"
    }
  ],
  "isError": true,
  "error": {
    "code": "E1201",
    "message": "Key 'invalid_key' not found in namespace 'default'",
    "timestamp": "2024-03-29T10:30:00.000Z",
    "requestId": "abc123def456"
  }
}
```

### Error Codes

| Code | Category | Description |
|------|----------|-------------|
| E1000-E1099 | Database | Connection failures, query errors |
| E1100-E1199 | Validation | Invalid input parameters |
| E1200-E1299 | Business Logic | Limits exceeded, resources not found |
| E1300-E1399 | System | File system, permission errors |
| E1400-E1499 | Format Conversion | Unsupported formats, conversion failures |
| E1500-E1599 | License | Authentication, authorization issues |

### Common Errors

**Key Not Found (E1201)**
```json
{
  "content": [{"type": "text", "text": "[E1201] Key 'missing_key' not found"}],
  "isError": true
}
```

**Daily Limit Exceeded (E1200)**
```json
{
  "content": [{"type": "text", "text": "[E1200] Daily log limit exceeded (100/100). Upgrade to Pro for unlimited logging."}],
  "isError": true
}
```

**Invalid Parameter (E1102)**
```json
{
  "content": [{"type": "text", "text": "[E1102] Invalid parameter 'ttl_seconds': expected number >= 1, got string"}],
  "isError": true
}
```

## Performance Guidelines

### Response Times
- Target: <50ms for all operations
- KV operations: <10ms
- Format conversion: <100ms (depends on content size)
- Log operations: <20ms

### Rate Limits
- Free tier: 100 log entries per day
- No limits on KV store or format conversion
- Pro tier: Unlimited logging

### Best Practices
1. Use namespaces to organize data
2. Set appropriate TTL values for temporary data
3. Use prefixes for efficient key listing
4. Log important operations for debugging
5. Use format conversion for data normalization

## Examples

### Example 1: User Session Management

```json
// Store user session
{
  "tool": "kv_set",
  "arguments": {
    "key": "session_abc123",
    "value": "{\"user_id\":123,\"created\":\"2024-03-29T10:00:00Z\"}",
    "namespace": "sessions",
    "ttl_seconds": 3600
  }
}

// Retrieve session
{
  "tool": "kv_get",
  "arguments": {
    "key": "session_abc123",
    "namespace": "sessions"
  }
}
```

### Example 2: Data Processing Pipeline

```json
// Convert CSV to JSON
{
  "tool": "format_convert",
  "arguments": {
    "input_format": "csv",
    "output_format": "json",
    "content": "id,name,email\n1,John,john@example.com"
  }
}

// Log processing
{
  "tool": "log_action",
  "arguments": {
    "tool_name": "data_pipeline",
    "action": "convert_csv_to_json",
    "input_summary": "1 row CSV data",
    "output_summary": "JSON array with 1 object"
  }
}
```

### Example 3: Debugging with Logs

```json
// Search recent errors
{
  "tool": "log_search",
  "arguments": {
    "date_from": "2024-03-28",
    "keyword": "error",
    "limit": 10
  }
}

// Get activity summary
{
  "tool": "log_summary",
  "arguments": {
    "date_from": "2024-03-28",
    "group_by": "tool"
  }
}
```

## Troubleshooting

### Common Issues

1. **License key not working**
   - Verify key is from MCP Marketplace
   - Check environment variable spelling
   - Ensure key hasn't expired

2. **Database errors**
   - Check file permissions for ~/.agentos/
   - Ensure sufficient disk space
   - Restart the MCP server

3. **Performance issues**
   - Check system memory usage
   - Consider using TTL for old data
   - Monitor log entry count

### Debug Mode

Enable debug logging by setting `AGENTOS_DEBUG=true` environment variable.

### Support

- GitHub Issues: https://github.com/agentos-mcp/server/issues
- Discord: https://discord.gg/agentos
- Documentation: https://docs.agentos-mcp.com
