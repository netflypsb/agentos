# AgentOS — Operating System for AI Agents

> The infrastructure layer that gives AI agents persistent memory, task management, and team collaboration capabilities. Think of it as the SQLite of the AI agent world — one MCP server, zero config, every service your agent needs.

## The Problem We Solve

AI agents today have a critical limitation: **they forget everything when the conversation ends.** Without persistent infrastructure, agents cannot:

- Remember what they did yesterday
- Track complex, multi-step tasks across sessions
- Collaborate with other agents or human teams
- Maintain audit trails for compliance
- Prevent runaway loops and resource exhaustion

AgentOS fixes this by providing the missing operating system layer for AI agents.

## What AgentOS Does

AgentOS is an **MCP (Model Context Protocol) server** that gives AI agents the same infrastructure that traditional software takes for granted: persistent storage, state management, collaboration tools, and monitoring.

### Core Capabilities

**1. Persistent Memory**
Your agents can store and retrieve data across sessions. Set a value today, retrieve it next week. Namespaces keep data organized, and TTL support enables temporary storage that auto-expires.

**2. Task Management**
Break complex workflows into trackable tasks with checkpoints. Create a task, save progress at key milestones, rollback if something goes wrong, and maintain a complete history of what happened.

**3. Resource Protection**
Set budgets to prevent runaway loops and resource exhaustion. Automatic loop detection catches infinite cycles before they drain your compute budget.

**4. Team Collaboration**
Create isolated workspaces for teams. Manage members with role-based permissions (admin, manager, member, viewer). Share resources while maintaining security boundaries.

**5. Enterprise Security**
Complete audit trails for SOC2, GDPR, and HIPAA compliance. Data encryption at rest. Role-based access control with granular permissions.

**6. Operations & Monitoring**
Real-time performance metrics, intelligent alerting, capacity planning, and business intelligence reporting. Know when to scale before you hit limits.

**7. Workflow Automation**
Template engine for reusable document and workflow patterns. Convert between formats (Markdown, HTML, CSV, JSON, YAML, XML). Structured logging with search and export.

## What You Can Build

With AgentOS, your AI agents can now:

- **Remember project context** across multiple sessions over days or weeks
- **Track complex deployments** with rollback capability if something fails
- **Collaborate as a team** with shared workspaces and role-based access
- **Maintain compliance** with complete audit trails for every action
- **Prevent disasters** with automatic loop detection and budget enforcement
- **Scale confidently** with monitoring, alerting, and capacity planning

## Quick Start

Add to your Claude Desktop or any MCP client:

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

No configuration needed. AgentOS automatically creates a local SQLite database at `~/.agentos/agentos.db` for persistent storage.

## Example Use Cases

**Personal Productivity**
- Store research notes that persist across conversations
- Track long-running projects with task checkpoints
- Log all activities for later reference and analysis

**Software Development**
- Manage multi-step deployment workflows with rollback capability
- Track feature development across multiple coding sessions
- Maintain audit logs for compliance requirements

**Team Collaboration**
- Share knowledge bases across team members
- Coordinate complex projects with shared task tracking
- Maintain consistent templates and workflows

**Enterprise Operations**
- Ensure compliance with complete audit trails
- Monitor system health and performance metrics
- Plan capacity based on usage patterns and predictions

## Architecture

- **Protocol**: MCP (Model Context Protocol) — works with Claude, Cursor, and any MCP-compatible client
- **Storage**: SQLite with sql.js — portable, zero-config, no external dependencies
- **Security**: AES-256-GCM encryption, role-based access control, audit logging
- **Deployment**: npm install, Docker, or self-hosted — your choice

## Installation

```bash
# Install globally
npm install -g agentos-mcp

# Run standalone
agentos-mcp

# Or use with npx (no install needed)
npx -y agentos-mcp
```

## Development

```bash
# Clone and install
git clone https://github.com/netflypsb/agentos.git
cd agentos
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## Works With

Claude Desktop · Claude Code · Cursor · Windsurf · VS Code · Zed · any MCP client

## Support

- **Documentation**: [GitHub Repository](https://github.com/netflypsb/agentos)
- **Issues**: [GitHub Issues](https://github.com/netflypsb/agentos/issues)
- **MCP Marketplace**: Available on the MCP Marketplace for enhanced features

## License

MIT License — see [LICENSE](LICENSE) file for details.
