# AgentOS — Essential services for AI agents

> The SQLite of the AI agent world. One MCP server. Zero config. 
> Every service your agent needs but nobody wants to build.

## Quick Start (30 seconds)

Add to your Claude Desktop config:
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

## What's Included

### Free (always available)
| Tool | What it does |
|---|---|
| `kv_set/get/delete/list` | Persistent key-value memory |
| `format_convert` | MD↔HTML, CSV↔JSON, YAML↔JSON, XML→JSON |
| `log_action/search/export` | Structured activity logging (100/day) |

### Pro ($12/month)
| Tool | What it does |
|---|---|
| `task_create/checkpoint/rollback/status/complete/list` | Multi-step task state management |
| `budget_set/consume/check/status` + `loop_detect` | Cost control & runaway prevention |
| `template_list/render/create` | Document scaffolding with 6 built-in templates |
| **Plus**: Multi-workspace support, advanced license management, resource limits |

### Team ($39/month - 5 seats)
| Tool | What it does |
|---|---|
| Everything in Pro + |
| `workspace_create/delete/manage` | Team workspace management |
| `member_invite/remove/permissions` | Team member management |
| `team_analytics/reports` | Usage analytics and reporting |

### Enterprise (Custom pricing)
| Tool | What it does |
|---|---|
| Everything in Team + |
| `sso_configure/manage` | Single sign-on integration |
| `audit_logs/export` | Compliance audit trails |
| `custom_templates/deploy` | Branded template management |
| `api_keys/manage` | Programmatic access |

## Get Pro
→ [Purchase on MCP Marketplace](https://mcp-marketplace.io/agentos-mcp)
→ Set `AGENTOS_LICENSE_KEY` in your MCP config

## Works With
Claude Desktop · Claude Code · Cursor · Windsurf · VS Code · Zed · any MCP client

## Installation

```bash
# Install globally
npm install -g agentos-mcp

# Run standalone
agentos-mcp start

# Or use with npx (no install needed)
npx -y agentos-mcp
```

## Development

```bash
# Clone and install
git clone https://github.com/agentos-mcp/server.git
cd agentos-mcp
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## Architecture

- **SQLite Database**: Local persistence in `~/.agentos/agentos.db`
- **MCP Protocol**: Standard Model Context Protocol integration
- **Zero Dependencies**: No external APIs or services required
- **Multi-Workspace**: Team and enterprise isolation support

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [GitHub Wiki](https://github.com/agentos-mcp/server/wiki)
- **Issues**: [GitHub Issues](https://github.com/agentos-mcp/server/issues)
- **Community**: [Discord](https://discord.gg/agentos)
