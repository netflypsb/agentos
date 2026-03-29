# AgentOS

## Tagline
Operating System for AI Agents - persistent memory, task management, and team collaboration.

## Description
AgentOS is an MCP server that gives AI agents the infrastructure they need to be truly useful. It provides persistent key-value memory across sessions, task management with checkpoints and rollback, team workspaces with role-based access control, and enterprise-grade security with audit logging and compliance reporting.

Think of it as the missing operating system layer for AI agents. Without AgentOS, agents forget everything when the conversation ends. With AgentOS, they remember, track progress, collaborate with teams, and maintain audit trails for compliance.

**Free tier available.** Paid plans start at $15/mo for professionals and $49/mo for teams.

## Setup Requirements
No API keys required for local usage. The server uses SQLite for persistent storage in `~/.agentos/agentos.db`.

Optional environment variables:
- `AGENTOS_DATA_DIR` (optional): Custom directory for database storage. Default: `~/.agentos`
- `MCP_MARKETPLACE_LICENSE_KEY` (optional for paid features): License key for Pro/Team/Enterprise features. Get one at https://mcp-marketplace.io/agentos

## Category
Developer Tools

## Use Cases
Memory Management, Task Tracking, Team Collaboration, Compliance Auditing, Workflow Automation, Session Persistence, State Management, Project Management

## Features
- **Persistent KV Store**: Store and retrieve data across sessions with namespaces and TTL support
- **Task Management**: Create tasks, set checkpoints, rollback to previous states, complete or abort tasks
- **Budget & Loop Detection**: Set resource budgets and automatically detect infinite loops
- **Template Engine**: Jinja2-style templating with built-in library for reusable workflows
- **Team Workspaces**: Isolated environments for teams with member management and shared resources
- **Role-Based Access Control**: Admin, manager, member, and viewer roles with granular permissions
- **Audit Logging**: Complete audit trails for SOC2, GDPR, and HIPAA compliance
- **Usage Analytics**: Dashboard and reports for tracking feature usage
- **Customer Support**: Built-in ticket system with knowledge base and auto-responses
- **Real-time Monitoring**: Performance metrics, alerting, and capacity planning
- **Business Intelligence**: Usage reports, growth predictions, and conversion analytics
- **Data Encryption**: AES-256-GCM encryption for sensitive data at rest
- **Format Conversion**: Convert between MD, HTML, CSV, JSON, YAML, and XML formats
- **Activity Logging**: Structured logging with search and export capabilities

## Getting Started
- "Remember this project roadmap for next time: kv_set(key='roadmap', value='Q2 goals...')"
- "Create a task to track this complex deployment: task_create(session_id='deploy', name='Release v2.0')"
- "Check what we did yesterday: log_search(query='deployment')"
- Tool: kv_set — Store a key-value pair with optional namespace and TTL
- Tool: kv_get — Retrieve a previously stored value
- Tool: task_create — Start tracking a new task with session isolation
- Tool: task_checkpoint — Save the current state so you can rollback later
- Tool: workspace_create — Create a team workspace for collaboration (Team tier)
- Tool: monitoring_system_status — Check overall system health and active alerts

## Tags
mcp, ai-agents, memory, task-management, collaboration, productivity, compliance, audit, monitoring, templates, kv-store, workflow, state-management, team-workspace, rbac, enterprise-security

## Documentation URL
https://github.com/netflypsb/agentos/blob/main/README.md

## Health Check URL
Not applicable - runs locally via stdio transport
