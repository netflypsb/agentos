// Usage Analytics Module for AgentOS
// Tracks tool usage patterns and provides analytics dashboard

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "./db.js";
import { AgentErrorFactory, withErrorHandling, ErrorCode } from "./errors.js";
import type { LicenseInfo } from "./license.js";

export interface UsageMetrics {
  date: string;
  feature: string;
  usage_count: number;
  unique_sessions: number;
  average_duration_ms: number;
}

export interface DailyReport {
  date: string;
  totalCalls: number;
  uniqueFeatures: number;
  topFeatures: Array<{ feature: string; count: number }>;
  freeTierUsage: Record<string, number>;
  approachingLimits: string[];
}

export class UsageAnalytics {
  // Track a tool usage event
  static trackEvent(feature: string, durationMs: number = 0, sessionId?: string): void {
    if (!db) return;

    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Insert or update daily usage
      db.prepare(`
        INSERT INTO usage_tracking (date, feature, usage_count, last_updated)
        VALUES (?, ?, 1, unixepoch())
        ON CONFLICT(date, feature) DO UPDATE SET
          usage_count = usage_count + 1,
          last_updated = unixepoch()
      `).run(today, feature);

      // Track session usage if sessionId provided
      if (sessionId) {
        db.prepare(`
          INSERT OR IGNORE INTO session_usage (date, session_id, feature)
          VALUES (?, ?, ?)
        `).run(today, sessionId, feature);
      }

      // Track performance metrics
      db.prepare(`
        INSERT INTO performance_metrics (date, feature, duration_ms, timestamp)
        VALUES (?, ?, ?, unixepoch())
      `).run(today, feature, durationMs);
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  // Get usage metrics for a date range
  static getMetrics(startDate: string, endDate: string): UsageMetrics[] {
    if (!db) return [];

    try {
      const results = db.prepare(`
        SELECT 
          u.date,
          u.feature,
          u.usage_count,
          COUNT(DISTINCT s.session_id) as unique_sessions,
          COALESCE(AVG(p.duration_ms), 0) as average_duration_ms
        FROM usage_tracking u
        LEFT JOIN session_usage s ON u.date = s.date AND u.feature = s.feature
        LEFT JOIN performance_metrics p ON u.date = p.date AND u.feature = p.feature
        WHERE u.date BETWEEN ? AND ?
        GROUP BY u.date, u.feature
        ORDER BY u.date DESC, u.usage_count DESC
      `).all(startDate, endDate) as UsageMetrics[];

      return results;
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return [];
    }
  }

  // Get daily report
  static getDailyReport(date?: string): DailyReport {
    if (!db) {
      return {
        date: date || new Date().toISOString().split('T')[0],
        totalCalls: 0,
        uniqueFeatures: 0,
        topFeatures: [],
        freeTierUsage: {},
        approachingLimits: []
      };
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      // Total calls
      const totalResult = db.prepare(`
        SELECT SUM(usage_count) as total FROM usage_tracking WHERE date = ?
      `).get(targetDate) as { total: number } | undefined;

      // Top features
      const topFeatures = db.prepare(`
        SELECT feature, usage_count as count 
        FROM usage_tracking 
        WHERE date = ?
        ORDER BY usage_count DESC
        LIMIT 5
      `).all(targetDate) as Array<{ feature: string; count: number }>;

      // Free tier features usage (limited features)
      const freeTierFeatures = ['agent_log_limited'];
      const freeTierUsage: Record<string, number> = {};
      
      for (const feature of freeTierFeatures) {
        const result = db.prepare(`
          SELECT usage_count FROM usage_tracking WHERE date = ? AND feature = ?
        `).get(targetDate, feature) as { usage_count: number } | undefined;
        
        if (result) {
          freeTierUsage[feature] = result.usage_count;
        }
      }

      // Check approaching limits (daily log limit is 100)
      const approachingLimits: string[] = [];
      if (freeTierUsage['agent_log_limited'] && freeTierUsage['agent_log_limited'] > 80) {
        approachingLimits.push(`agent_log_limited (${freeTierUsage['agent_log_limited']}/100)`);
      }

      return {
        date: targetDate,
        totalCalls: totalResult?.total || 0,
        uniqueFeatures: topFeatures.length,
        topFeatures,
        freeTierUsage,
        approachingLimits
      };
    } catch (error) {
      console.error('Failed to generate daily report:', error);
      return {
        date: targetDate,
        totalCalls: 0,
        uniqueFeatures: 0,
        topFeatures: [],
        freeTierUsage: {},
        approachingLimits: []
      };
    }
  }

  // Get usage patterns (day over day)
  static getUsagePatterns(days: number = 7): Array<{ date: string; total: number }> {
    if (!db) return [];

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = db.prepare(`
        SELECT date, SUM(usage_count) as total
        FROM usage_tracking
        WHERE date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date ASC
      `).all(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ) as Array<{ date: string; total: number }>;

      return results;
    } catch (error) {
      console.error('Failed to get usage patterns:', error);
      return [];
    }
  }

  // Initialize analytics tables
  static initializeTables(): void {
    if (!db) return;

    try {
      // Session usage tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          session_id TEXT NOT NULL,
          feature TEXT NOT NULL,
          UNIQUE(date, session_id, feature)
        );

        CREATE INDEX IF NOT EXISTS idx_session_usage_date ON session_usage(date);
        CREATE INDEX IF NOT EXISTS idx_session_usage_feature ON session_usage(feature);
      `);

      // Performance metrics
      db.exec(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          feature TEXT NOT NULL,
          duration_ms INTEGER,
          timestamp INTEGER DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_perf_date ON performance_metrics(date);
        CREATE INDEX IF NOT EXISTS idx_perf_feature ON performance_metrics(feature);
      `);
    } catch (error) {
      console.error('Failed to initialize analytics tables:', error);
    }
  }

  // Cleanup old analytics data
  static cleanup(daysToKeep: number = 90): void {
    if (!db) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoff = cutoffDate.toISOString().split('T')[0];

      db.prepare(`DELETE FROM usage_tracking WHERE date < ?`).run(cutoff);
      db.prepare(`DELETE FROM session_usage WHERE date < ?`).run(cutoff);
      db.prepare(`DELETE FROM performance_metrics WHERE date < ?`).run(cutoff);
    } catch (error) {
      console.error('Failed to cleanup analytics data:', error);
    }
  }
}

// Register analytics tools
export function registerAnalyticsTools(server: McpServer, _license: LicenseInfo) {
  // Initialize tables
  UsageAnalytics.initializeTables();

  server.tool(
    "analytics_dashboard",
    "Get usage analytics dashboard for today or specified date range.",
    {
      date: z.string().optional().describe("Target date (YYYY-MM-DD, default: today)"),
      days: z.number().optional().default(7).describe("Number of days for trend analysis"),
    },
    withErrorHandling(async ({ date, days }) => {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        throw AgentErrorFactory.create(ErrorCode.INVALID_INPUT_FORMAT, "Invalid date format. Use YYYY-MM-DD");
      }

      const report = UsageAnalytics.getDailyReport(targetDate);
      const patterns = UsageAnalytics.getUsagePatterns(days);

      const trend = patterns.length > 1 
        ? `Trend: ${patterns[patterns.length - 1].total > patterns[0].total ? '↗️' : '↘️'} (${patterns[0].total} → ${patterns[patterns.length - 1].total})`
        : 'Trend: Not enough data';

      const limitWarning = report.approachingLimits.length > 0
        ? `\n⚠️ Approaching Limits:\n${report.approachingLimits.join('\n')}`
        : '';

      const topFeatures = report.topFeatures.length > 0
        ? report.topFeatures.map((f, i) => `${i + 1}. ${f.feature}: ${f.count}`).join('\n')
        : 'No usage data available';

      return {
        content: [{
          type: "text",
          text: `📊 Analytics Dashboard - ${report.date}\n\n` +
               `Total Calls: ${report.totalCalls}\n` +
               `Active Features: ${report.uniqueFeatures}\n` +
               `${trend}\n\n` +
               `Top Features:\n${topFeatures}${limitWarning}`
        }]
      };
    })
  );

  server.tool(
    "analytics_report",
    "Generate detailed usage report for a date range.",
    {
      start_date: z.string().describe("Start date (YYYY-MM-DD)"),
      end_date: z.string().describe("End date (YYYY-MM-DD)"),
      feature: z.string().optional().describe("Filter by specific feature"),
    },
    withErrorHandling(async ({ start_date, end_date, feature }) => {
      // Validate dates
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
        throw AgentErrorFactory.create(ErrorCode.INVALID_INPUT_FORMAT, "Invalid date format. Use YYYY-MM-DD");
      }

      const metrics = UsageAnalytics.getMetrics(start_date, end_date);
      
      if (feature) {
        const filtered = metrics.filter(m => m.feature === feature);
        const total = filtered.reduce((sum, m) => sum + m.usage_count, 0);
        
        return {
          content: [{
            type: "text",
            text: `📈 Feature Report: ${feature}\n` +
                 `Period: ${start_date} to ${end_date}\n\n` +
                 `Total Usage: ${total}\n` +
                 `Days Active: ${filtered.length}\n` +
                 `Daily Average: ${(total / Math.max(1, filtered.length)).toFixed(1)}`
          }]
        };
      }

      const totalCalls = metrics.reduce((sum, m) => sum + m.usage_count, 0);
      const uniqueFeatures = [...new Set(metrics.map(m => m.feature))];
      
      const featureSummary = uniqueFeatures.map(f => {
        const featureMetrics = metrics.filter(m => m.feature === f);
        const featureTotal = featureMetrics.reduce((sum, m) => sum + m.usage_count, 0);
        return `  ${f}: ${featureTotal} calls`;
      }).join('\n');

      return {
        content: [{
          type: "text",
          text: `📈 Usage Report\n` +
               `Period: ${start_date} to ${end_date}\n\n` +
               `Total Calls: ${totalCalls}\n` +
               `Unique Features: ${uniqueFeatures.length}\n\n` +
               `Feature Breakdown:\n${featureSummary || 'No data available'}`
        }]
      };
    })
  );
}
