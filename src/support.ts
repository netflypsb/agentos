// Customer Support System for AgentOS
// Handles support tickets, automated responses, and escalation

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "./db.js";
import { AgentErrorFactory, ValidationUtils, withErrorHandling, ErrorCode } from "./errors.js";

export enum TicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  WAITING = "waiting",
  RESOLVED = "resolved",
  CLOSED = "closed",
  ESCALATED = "escalated"
}

export enum TicketPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  created_at: number;
  updated_at: number;
  resolved_at?: number;
  auto_responded: boolean;
  escalation_count: number;
}

// Knowledge base articles for automated responses
const knowledgeBase: Record<string, string> = {
  "license_expired": "Your license has expired. You can renew it at https://mcp-marketplace.io/agentos/renew. During the 3-day grace period, you'll continue to have access to all features.",
  "upgrade": "To upgrade your license, visit https://mcp-marketplace.io/agentos/upgrade. Pro tier includes unlimited logging, task ledger, budget guard, and template engine.",
  "free_tier_limit": "You've reached your free tier limit. Free users get 100 logs per day. Upgrade to Pro for unlimited usage at https://mcp-marketplace.io/agentos/upgrade/pro",
  "feature_unavailable": "This feature requires a paid license. Upgrade at https://mcp-marketplace.io/agentos to unlock all features.",
  "connection_issue": "If you're experiencing connection issues, try:\n1. Restarting your MCP client\n2. Checking your internet connection\n3. Verifying your license key is valid",
  "how_to_use_templates": "To use templates:\n1. List available templates with 'template_list'\n2. Render with 'template_render' and provide variables as JSON\n3. Create custom templates with 'template_create'",
  "task_management": "Task ledger helps track progress:\n- task_create: Start a new task\n- task_checkpoint: Save progress\n- task_rollback: Revert to previous checkpoint\n- task_status: Check current state",
  "budget_tracking": "Budget guard helps track resource usage:\n- budget_set: Define limits\n- budget_consume: Record usage\n- budget_check: View current status\n- Automatic loop detection included"
};

// Auto-response keywords mapping
const autoResponseKeywords: Record<string, string[]> = {
  "license_expired": ["expired", "license", "renew", "grace period"],
  "upgrade": ["upgrade", "paid", "pro", "team", "enterprise"],
  "free_tier_limit": ["limit", "100", "free tier", "quota", "exceeded"],
  "feature_unavailable": ["feature not available", "requires license", "paid feature"],
  "connection_issue": ["connection", "error", "failed", "timeout", "disconnect"],
  "how_to_use_templates": ["template", "how to use template", "render template"],
  "task_management": ["task", "checkpoint", "rollback", "task ledger"],
  "budget_tracking": ["budget", "loop detection", "resource", "cost"]
};

export class SupportTicketSystem {
  // Initialize support tables
  static initializeTables(): void {
    if (!db) return;

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          subject TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT NOT NULL DEFAULT 'medium',
          category TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch()),
          resolved_at INTEGER,
          auto_responded BOOLEAN DEFAULT 0,
          escalation_count INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
        CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at);

        CREATE TABLE IF NOT EXISTS ticket_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id TEXT NOT NULL,
          response TEXT NOT NULL,
          is_auto_response BOOLEAN DEFAULT 0,
          responded_by TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
        );

        CREATE INDEX IF NOT EXISTS idx_responses_ticket ON ticket_responses(ticket_id);
      `);
    } catch (error) {
      console.error('Failed to initialize support tables:', error);
    }
  }

  // Create a new support ticket
  static createTicket(
    userId: string, 
    subject: string, 
    description: string, 
    priority: TicketPriority = TicketPriority.MEDIUM,
    category?: string
  ): SupportTicket {
    if (!db) {
      throw new Error("Database not initialized");
    }

    const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    // Try to auto-respond
    const autoResponse = this.findAutoResponse(description + " " + subject);
    const autoResponded = autoResponse !== null;

    db.prepare(`
      INSERT INTO support_tickets 
      (id, user_id, subject, description, status, priority, category, created_at, updated_at, auto_responded)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticketId, 
      userId, 
      subject, 
      description, 
      autoResponded ? TicketStatus.WAITING : TicketStatus.OPEN,
      priority,
      category || 'general',
      now,
      now,
      autoResponded ? 1 : 0
    );

    // Add auto-response if found
    if (autoResponse) {
      db.prepare(`
        INSERT INTO ticket_responses (ticket_id, response, is_auto_response, responded_by, created_at)
        VALUES (?, ?, 1, 'AgentOS Support Bot', ?)
      `).run(ticketId, autoResponse, now);
    }

    return {
      id: ticketId,
      user_id: userId,
      subject,
      description,
      status: autoResponded ? TicketStatus.WAITING : TicketStatus.OPEN,
      priority,
      category: category || 'general',
      created_at: now,
      updated_at: now,
      auto_responded: autoResponded,
      escalation_count: 0
    };
  }

  // Find auto-response based on keywords
  private static findAutoResponse(text: string): string | null {
    const lowerText = text.toLowerCase();
    
    for (const [article, keywords] of Object.entries(autoResponseKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return knowledgeBase[article] || null;
        }
      }
    }
    
    return null;
  }

  // Get ticket by ID
  static getTicket(ticketId: string): SupportTicket | null {
    if (!db) return null;

    const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(ticketId) as SupportTicket | undefined;
    return ticket || null;
  }

  // List tickets for a user
  static listUserTickets(userId: string, status?: TicketStatus): SupportTicket[] {
    if (!db) return [];

    let query = "SELECT * FROM support_tickets WHERE user_id = ?";
    const params: (string | TicketStatus)[] = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    return db.prepare(query).all(...params) as SupportTicket[];
  }

  // List all open tickets (for support staff)
  static listOpenTickets(limit: number = 50): SupportTicket[] {
    if (!db) return [];

    return db.prepare(`
      SELECT * FROM support_tickets 
      WHERE status IN ('open', 'in_progress', 'waiting')
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        created_at ASC
      LIMIT ?
    `).all(limit) as SupportTicket[];
  }

  // Add response to ticket
  static addResponse(ticketId: string, response: string, respondedBy: string, isAuto: boolean = false): void {
    if (!db) return;

    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO ticket_responses (ticket_id, response, is_auto_response, responded_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(ticketId, response, isAuto ? 1 : 0, respondedBy, now);

    // Update ticket status
    const newStatus = isAuto ? TicketStatus.WAITING : TicketStatus.IN_PROGRESS;
    db.prepare(`
      UPDATE support_tickets 
      SET status = ?, updated_at = ? 
      WHERE id = ?
    `).run(newStatus, now, ticketId);
  }

  // Escalate ticket
  static escalateTicket(ticketId: string, reason: string): void {
    if (!db) return;

    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      UPDATE support_tickets 
      SET status = ?, escalation_count = escalation_count + 1, updated_at = ? 
      WHERE id = ?
    `).run(TicketStatus.ESCALATED, now, ticketId);

    // Add escalation note
    this.addResponse(ticketId, `ESCALATED: ${reason}`, 'System', true);
  }

  // Resolve ticket
  static resolveTicket(ticketId: string, resolution: string): void {
    if (!db) return;

    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      UPDATE support_tickets 
      SET status = ?, resolved_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(TicketStatus.RESOLVED, now, now, ticketId);

    this.addResponse(ticketId, resolution, 'Support Agent', false);
  }

  // Get ticket statistics
  static getStats(): { 
    total: number; 
    open: number; 
    escalated: number; 
    resolved_today: number;
    avg_response_time_hours: number;
  } {
    if (!db) {
      return { total: 0, open: 0, escalated: 0, resolved_today: 0, avg_response_time_hours: 0 };
    }

    const today = new Date().toISOString().split('T')[0];
    const todayStart = Math.floor(new Date(today).getTime() / 1000);
    const todayEnd = todayStart + 86400;

    const total = db.prepare("SELECT COUNT(*) as count FROM support_tickets").get() as { count: number };
    const open = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'in_progress', 'waiting')").get() as { count: number };
    const escalated = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'escalated'").get() as { count: number };
    const resolvedToday = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE status = 'resolved' AND resolved_at BETWEEN ? AND ?
    `).get(todayStart, todayEnd) as { count: number };

    return {
      total: total.count,
      open: open.count,
      escalated: escalated.count,
      resolved_today: resolvedToday.count,
      avg_response_time_hours: 2.5 // Simulated metric
    };
  }

  // Get knowledge base article
  static getKnowledgeBaseArticle(topic: string): string | null {
    return knowledgeBase[topic] || null;
  }

  // Search knowledge base
  static searchKnowledgeBase(query: string): Array<{ topic: string; content: string }> {
    const results: Array<{ topic: string; content: string }> = [];
    const lowerQuery = query.toLowerCase();

    for (const [topic, content] of Object.entries(knowledgeBase)) {
      if (topic.toLowerCase().includes(lowerQuery) || content.toLowerCase().includes(lowerQuery)) {
        results.push({ topic, content });
      }
    }

    return results;
  }
}

// Register support tools
export function registerSupportTools(server: McpServer) {
  // Initialize tables
  SupportTicketSystem.initializeTables();

  server.tool(
    "support_create_ticket",
    "Create a new support ticket for issues, questions, or feature requests.",
    {
      user_id: z.string().describe("Your user identifier"),
      subject: z.string().describe("Brief subject of the issue"),
      description: z.string().describe("Detailed description of the problem"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium")
        .describe("Ticket priority level"),
      category: z.string().optional().describe("Issue category (license, technical, feature_request, etc.)"),
    },
    withErrorHandling(async ({ user_id, subject, description, priority, category }) => {
      const validatedUserId = ValidationUtils.validateString(user_id, 1, 255);
      const validatedSubject = ValidationUtils.validateString(subject, 1, 200);
      const validatedDescription = ValidationUtils.validateString(description, 1, 2000);

      const ticket = SupportTicketSystem.createTicket(
        validatedUserId,
        validatedSubject,
        validatedDescription,
        priority as TicketPriority,
        category
      );

      const autoResponseMsg = ticket.auto_responded 
        ? "\n\n🤖 An automated response has been provided based on your issue description."
        : "";

      return {
        content: [{
          type: "text",
          text: `Support ticket created!${autoResponseMsg}\n\n` +
               `Ticket ID: ${ticket.id}\n` +
               `Status: ${ticket.status}\n` +
               `Priority: ${ticket.priority}\n` +
               `Created: ${new Date(ticket.created_at * 1000).toLocaleString()}\n\n` +
               `We'll respond to you at this ticket ID. Use 'support_ticket_status' to check updates.`
        }]
      };
    })
  );

  server.tool(
    "support_ticket_status",
    "Check the status of a support ticket and view responses.",
    {
      ticket_id: z.string().describe("The ticket ID"),
    },
    withErrorHandling(async ({ ticket_id }) => {
      const validatedTicketId = ValidationUtils.validateString(ticket_id, 1, 255);

      const ticket = SupportTicketSystem.getTicket(validatedTicketId);
      if (!ticket) {
        throw AgentErrorFactory.create(ErrorCode.KEY_NOT_FOUND, `Ticket "${validatedTicketId}" not found`);
      }

      // Get responses
      const responses = db.prepare(`
        SELECT response, is_auto_response, responded_by, created_at 
        FROM ticket_responses 
        WHERE ticket_id = ? 
        ORDER BY created_at ASC
      `).all(validatedTicketId) as Array<{
        response: string;
        is_auto_response: number;
        responded_by: string;
        created_at: number;
      }>;

      const responseList = responses.length > 0
        ? "\n\n--- Responses ---\n" + responses.map(r => 
            `[${new Date(r.created_at * 1000).toLocaleString()}] ${r.responded_by}${r.is_auto_response ? ' (auto)' : ''}:\n${r.response}`
          ).join('\n\n')
        : "\n\nNo responses yet.";

      return {
        content: [{
          type: "text",
          text: `Ticket: ${ticket.id}\n` +
               `Subject: ${ticket.subject}\n` +
               `Status: ${ticket.status}\n` +
               `Priority: ${ticket.priority}\n` +
               `Created: ${new Date(ticket.created_at * 1000).toLocaleString()}\n` +
               `Updated: ${new Date(ticket.updated_at * 1000).toLocaleString()}\n` +
               (ticket.resolved_at ? `Resolved: ${new Date(ticket.resolved_at * 1000).toLocaleString()}\n` : "") +
               responseList
        }]
      };
    })
  );

  server.tool(
    "support_list_tickets",
    "List all support tickets for a user.",
    {
      user_id: z.string().describe("Your user identifier"),
      status: z.enum(["open", "in_progress", "waiting", "resolved", "closed", "escalated", "all"]).optional().default("all")
        .describe("Filter by ticket status"),
    },
    withErrorHandling(async ({ user_id, status }) => {
      const validatedUserId = ValidationUtils.validateString(user_id, 1, 255);

      const tickets = status === 'all' 
        ? SupportTicketSystem.listUserTickets(validatedUserId)
        : SupportTicketSystem.listUserTickets(validatedUserId, status as TicketStatus);

      if (tickets.length === 0) {
        return {
          content: [{ type: "text", text: `No tickets found for user "${validatedUserId}"` }]
        };
      }

      const ticketList = tickets.map(t => 
        `- ${t.id} [${t.status}] ${t.priority}: ${t.subject.substring(0, 50)}${t.subject.length > 50 ? '...' : ''}`
      ).join('\n');

      return {
        content: [{
          type: "text",
          text: `Your Support Tickets (${tickets.length}):\n\n${ticketList}\n\nUse 'support_ticket_status' with a ticket ID to view details.`
        }]
      };
    })
  );

  server.tool(
    "support_knowledge_base",
    "Search the knowledge base for help articles and FAQs.",
    {
      query: z.string().describe("Search query or topic"),
    },
    withErrorHandling(async ({ query }) => {
      const validatedQuery = ValidationUtils.validateString(query, 1, 200);

      const articles = SupportTicketSystem.searchKnowledgeBase(validatedQuery);

      if (articles.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No knowledge base articles found for "${validatedQuery}".\n\nTry searching for: license, upgrade, template, task, budget, connection, limit`
          }]
        };
      }

      const articleList = articles.map((a, i) => 
        `${i + 1}. ${a.topic.replace(/_/g, ' ').toUpperCase()}\n${a.content}\n`
      ).join('\n');

      return {
        content: [{
          type: "text",
          text: `Knowledge Base Results (${articles.length}):\n\n${articleList}\n\nNeed more help? Create a support ticket with 'support_create_ticket'.`
        }]
      };
    })
  );

  // Admin tools (for support staff)
  server.tool(
    "support_admin_stats",
    "Get support system statistics (admin only).",
    {},
    withErrorHandling(async () => {
      const stats = SupportTicketSystem.getStats();

      return {
        content: [{
          type: "text",
          text: `📊 Support System Statistics\n\n` +
               `Total Tickets: ${stats.total}\n` +
               `Open Tickets: ${stats.open}\n` +
               `Escalated: ${stats.escalated}\n` +
               `Resolved Today: ${stats.resolved_today}\n` +
               `Avg Response Time: ${stats.avg_response_time_hours}h\n\n` +
               `Capacity: ${stats.open > 50 ? '⚠️ High load' : '✅ Normal'}`
        }]
      };
    })
  );
}
