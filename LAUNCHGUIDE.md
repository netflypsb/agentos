# AgentOS

## Tagline
Give your AI agents persistent memory, task management, and team collaboration capabilities.

## Description

AgentOS is an MCP (Model Context Protocol) server that acts as an operating system for AI agents. It solves the fundamental problem that AI agents forget everything when a conversation ends.

**What it does:**
AgentOS provides seven core infrastructure services that every AI agent needs:

1. **Persistent Memory** - Store and retrieve data across sessions. Set a value today, access it next week. Organize data with namespaces and set automatic expiration with TTL.

2. **Task Management** - Break complex workflows into trackable tasks. Create checkpoints at milestones, rollback to previous states if something fails, and maintain complete history.

3. **Resource Protection** - Set budgets to prevent runaway loops and resource exhaustion. Automatic loop detection stops infinite cycles before they drain your compute budget.

4. **Team Collaboration** - Create isolated workspaces for teams with role-based permissions (admin, manager, member, viewer). Share resources while maintaining security.

5. **Enterprise Security** - Complete audit trails for SOC2, GDPR, and HIPAA compliance. AES-256-GCM encryption at rest. Granular role-based access control.

6. **Operations & Monitoring** - Real-time performance metrics, intelligent alerting, capacity planning, and business intelligence reporting.

7. **Workflow Automation** - Template engine for reusable patterns. Convert between formats (Markdown, HTML, CSV, JSON, YAML, XML). Structured logging with search and export.

**How it works:**
AgentOS runs as a local MCP server using SQLite for storage. Zero configuration required — just add it to your Claude Desktop or Cursor config and it automatically creates a database at `~/.agentos/agentos.db`.

**Who it's for:**
- **Solo developers** who want their AI assistant to remember context across sessions
- **Software teams** building complex multi-step workflows that need rollback capability
- **Enterprises** requiring audit trails and compliance for AI operations
- **Teams** collaborating on shared projects with consistent templates and knowledge bases

## Setup Requirements

No API keys required for local usage. The server uses SQLite for persistent storage at `~/.agentos/agentos.db`.

Optional environment variables:
- `AGENTOS_DATA_DIR` (optional): Custom directory for database storage. Default is `~/.agentos`
- `MCP_MARKETPLACE_LICENSE_KEY` (optional): License key for accessing enhanced features via MCP Marketplace

## Category
Developer Tools

## Use Cases
Memory Management, Task Tracking, Team Collaboration, Compliance Auditing, Workflow Automation, Session Persistence, State Management, Project Management, Resource Monitoring, Enterprise Security

## Features

- Store and retrieve persistent data across AI sessions with the KV store
- Track complex multi-step tasks with checkpoints and rollback capability
- Prevent resource exhaustion with budget controls and automatic loop detection
- Collaborate with team workspaces and role-based access control
- Maintain compliance with complete audit trails for SOC2, GDPR, and HIPAA
- Monitor performance with real-time metrics and intelligent alerting
- Plan capacity with usage analytics and growth predictions
- Encrypt sensitive data at rest with AES-256-GCM
- Convert between document formats (Markdown, HTML, CSV, JSON, YAML, XML)
- Log all activities with structured logging and search capabilities
- Create reusable workflows with the template engine
- Organize data with namespaces for clean isolation
- Set automatic data expiration with TTL support
- Deploy anywhere — local, Docker, or self-hosted

## Getting Started

Try these prompts once AgentOS is installed:

- "Remember this project roadmap for next time: kv_set(key='roadmap', value='Q2 goals...')"
- "Create a task to track this deployment: task_create(session_id='deploy', name='Release v2.0')"
- "Check what we did yesterday: log_search(query='deployment')"
- "Create a team workspace for our project: workspace_create(name='Project Alpha')"
- "Check system health: monitoring_system_status"

**Key tools and when to use them:**

- **kv_set** — Store any data you need to remember later (settings, notes, state)
- **kv_get** — Retrieve previously stored data
- **task_create** — Start tracking a complex multi-step task
- **task_checkpoint** — Save current progress so you can rollback if needed
- **task_rollback** — Return to a previous checkpoint when something goes wrong
- **budget_set** — Prevent runaway resource consumption
- **loop_detect** — Catch infinite loops before they drain your budget
- **workspace_create** — Set up isolated environments for teams
- **monitoring_system_status** — Check overall health and active alerts

## Tags
mcp, ai-agents, memory, task-management, collaboration, productivity, compliance, audit, monitoring, templates, kv-store, workflow, state-management, team-workspace, rbac, enterprise-security, sqlite, zero-config

## Documentation URL
https://github.com/netflypsb/agentos/blob/main/README.md

## Health Check URL
Not applicable — runs locally via stdio transport
