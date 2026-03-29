# AgentOS Quick Start Guide

Get up and running with AgentOS in under 5 minutes.

## Installation

### Option 1: Global Install (Recommended)

```bash
npm install -g agentos-mcp
```

### Option 2: Use with npx (No install needed)

```bash
npx -y agentos-mcp
```

## Setup with Claude Desktop

1. **Open Claude Desktop Settings**
   - Click the gear icon ⚙️ in the bottom left
   - Go to "Developer" → "Edit MCP Settings"

2. **Add AgentOS Configuration**

```json
{
  "mcpServers": {
    "agentos": {
      "command": "agentos-mcp"
    }
  }
}
```

3. **Restart Claude Desktop**
   - Close and reopen Claude Desktop
   - AgentOS will be available in your conversations

## Your First AgentOS Commands

### 1. Store Your First Key-Value Pair

```
Use the kv_set tool to store a preference:
key: "theme"
value: "dark"
namespace: "preferences"
```

### 2. Retrieve Your Data

```
Use the kv_get tool to retrieve your theme:
key: "theme"
namespace: "preferences"
```

### 3. Convert Data Formats

```
Convert some CSV data to JSON:
input_format: "csv"
output_format: "json"
content: "name,age\nAlice,30\nBob,25"
```

### 4. Log Your Actions

```
Log what you're doing:
tool_name: "user_session"
action: "set_preference"
input_summary: "theme=dark"
```

## Common Use Cases

### User Session Management
```javascript
// Store session data
kv_set: {
  key: "session_123",
  value: '{"user_id": 123, "login_time": "2024-03-29"}',
  namespace: "sessions",
  ttl_seconds: 3600  // Expires in 1 hour
}

// Retrieve session
kv_get: {
  key: "session_123", 
  namespace: "sessions"
}
```

### Data Processing
```javascript
// Convert CSV to JSON for processing
format_convert: {
  input_format: "csv",
  output_format: "json", 
  content: "product,price,stock\nLaptop,999,50\nMouse,29,200"
}
```

### Debugging and Auditing
```javascript
// Log important operations
log_action: {
  tool_name: "data_processor",
  action: "convert_format",
  input_summary: "CSV with 2 rows",
  output_summary: "JSON array with 2 objects",
  duration_ms: 45
}

// Search recent activity
log_search: {
  date_from: "2024-03-28",
  limit: 10
}
```

## Pro Features (Optional)

Upgrade to Pro for unlimited logging and advanced features:

1. **Get License Key**
   - Visit [MCP Marketplace](https://mcp-marketplace.io/agentos-mcp)
   - Purchase Pro plan ($12/month)

2. **Set License Key**
   ```bash
   export AGENTOS_LICENSE_KEY="your-license-key-here"
   ```

3. **Restart Claude Desktop** to apply the license

## Troubleshooting

### AgentOS Not Showing Up
- Check Claude Desktop MCP settings
- Ensure `agentos-mcp` is installed (`npm list -g agentos-mcp`)
- Restart Claude Desktop completely

### Permission Errors
- Ensure `~/.agentos/` directory is writable
- On Windows, run as administrator if needed

### Performance Issues
- Check system resources (memory, disk space)
- Use TTL for temporary data to prevent buildup
- Monitor log entries (free tier limited to 100/day)

## Next Steps

- 📖 Read the [API Documentation](API.md) for complete reference
- 🧪 Try the [Examples](EXAMPLES.md) for advanced use cases
- 💬 Join our [Discord Community](https://discord.gg/agentos)
- 🐛 Report issues on [GitHub](https://github.com/agentos-mcp/issues)

## Need Help?

- **Quick Questions**: Ask in Claude Desktop - "How do I use AgentOS to..."
- **Technical Issues**: Check our [Troubleshooting Guide](TROUBLESHOOTING.md)
- **Feature Requests**: Open an issue on GitHub
- **Community Support**: Join our Discord server

---

**Happy building with AgentOS! 🚀**
