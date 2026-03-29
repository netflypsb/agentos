// Advanced Monitoring & Analytics Module for AgentOS
// Implements real-time monitoring, alerts, business intelligence, and capacity planning

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "./db.js";
import { withErrorHandling } from "./errors.js";
import type { LicenseInfo } from "./license.js";

// Metric types
export enum MetricType {
  PERFORMANCE = "performance",
  USAGE = "usage",
  ERROR = "error",
  CAPACITY = "capacity",
  BUSINESS = "business"
}

// Alert severity levels
export enum AlertSeverity {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical"
}

// Alert status
export enum AlertStatus {
  ACTIVE = "active",
  ACKNOWLEDGED = "acknowledged",
  RESOLVED = "resolved"
}

// Metric definition
export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  value: number;
  unit: string;
  timestamp: number;
  labels?: Record<string, string> | undefined;
}

// Alert definition
export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metricId: string;
  threshold: number;
  currentValue: number;
  triggeredAt: number;
  acknowledgedAt?: number | undefined;
  acknowledgedBy?: string | undefined;
  resolvedAt?: number | undefined;
}

// Dashboard definition
export interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
  refreshInterval: number;
  createdBy: string;
  createdAt: number;
}

export interface Widget {
  id: string;
  type: "chart" | "metric" | "table" | "alert";
  title: string;
  metricIds: string[];
  config: Record<string, unknown>;
}

// Performance Monitor
export class PerformanceMonitor {
  private static metrics = new Map<string, Metric[]>();
  private static readonly MAX_HISTORY = 1000;

  // Record a metric
  static recordMetric(metric: Omit<Metric, "id" | "timestamp">): Metric {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const fullMetric: Metric = { ...metric, id, timestamp };

    // Store in memory
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    const history = this.metrics.get(metric.name)!;
    history.push(fullMetric);

    // Trim history
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }

    // Also store in database for persistence
    if (db) {
      try {
        db.prepare(`
          INSERT INTO metrics (id, name, type, value, unit, timestamp, labels)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          metric.name,
          metric.type,
          metric.value,
          metric.unit,
          timestamp,
          metric.labels ? JSON.stringify(metric.labels) : null
        );
      } catch (error) {
        // Ignore DB errors for metrics
      }
    }

    return fullMetric;
  }

  // Get metric history
  static getMetricHistory(name: string, limit: number = 100): Metric[] {
    const history = this.metrics.get(name) || [];
    return history.slice(-limit);
  }

  // Get current metrics summary
  static getCurrentMetrics(): Metric[] {
    const current: Metric[] = [];
    for (const [, history] of this.metrics) {
      if (history.length > 0) {
        current.push(history[history.length - 1]);
      }
    }
    return current;
  }

  // Calculate average
  static calculateAverage(name: string, minutes: number = 5): number {
    const history = this.getMetricHistory(name, 1000);
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recent = history.filter(m => m.timestamp >= cutoff);
    
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, m) => acc + m.value, 0);
    return sum / recent.length;
  }

  // Initialize metrics table
  static initializeTables(): void {
    if (!db) return;

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS metrics (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          value REAL NOT NULL,
          unit TEXT,
          timestamp INTEGER NOT NULL,
          labels TEXT -- JSON
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
        CREATE INDEX IF NOT EXISTS idx_metrics_time ON metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type);

        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          severity TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT NOT NULL,
          metric_id TEXT,
          threshold REAL,
          current_value REAL,
          triggered_at INTEGER,
          acknowledged_at INTEGER,
          acknowledged_by TEXT,
          resolved_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

        CREATE TABLE IF NOT EXISTS dashboards (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          widgets TEXT, -- JSON
          refresh_interval INTEGER,
          created_by TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS capacity_predictions (
          id TEXT PRIMARY KEY,
          resource_type TEXT NOT NULL,
          current_usage REAL,
          predicted_usage_7d REAL,
          predicted_usage_30d REAL,
          capacity_limit REAL,
          risk_level TEXT, -- low, medium, high, critical
          recommended_action TEXT,
          generated_at INTEGER DEFAULT (unixepoch())
        );
      `);
    } catch (error) {
      console.error('Failed to initialize monitoring tables:', error);
    }
  }
}

// Alert Manager
export class AlertManager {
  private static alertRules = new Map<string, {
    metricName: string;
    threshold: number;
    comparison: 'gt' | 'lt' | 'eq';
    severity: AlertSeverity;
    message: string;
  }>();

  // Add alert rule
  static addAlertRule(
    name: string,
    metricName: string,
    threshold: number,
    comparison: 'gt' | 'lt' | 'eq',
    severity: AlertSeverity,
    message: string
  ): void {
    this.alertRules.set(name, {
      metricName,
      threshold,
      comparison,
      severity,
      message
    });
  }

  // Check alerts for a metric
  static checkAlerts(metric: Metric): Alert[] {
    const triggered: Alert[] = [];

    for (const [ruleName, rule] of this.alertRules) {
      if (rule.metricName !== metric.name) continue;

      let isTriggered = false;
      switch (rule.comparison) {
        case 'gt':
          isTriggered = metric.value > rule.threshold;
          break;
        case 'lt':
          isTriggered = metric.value < rule.threshold;
          break;
        case 'eq':
          isTriggered = metric.value === rule.threshold;
          break;
      }

      if (isTriggered) {
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: ruleName,
          severity: rule.severity,
          status: AlertStatus.ACTIVE,
          message: rule.message.replace('{value}', String(metric.value)).replace('{threshold}', String(rule.threshold)),
          metricId: metric.id,
          threshold: rule.threshold,
          currentValue: metric.value,
          triggeredAt: Date.now()
        };

        // Store in database
        if (db) {
          db.prepare(`
            INSERT INTO alerts (id, name, severity, status, message, metric_id, threshold, current_value, triggered_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            alert.id,
            alert.name,
            alert.severity,
            alert.status,
            alert.message,
            alert.metricId,
            alert.threshold,
            alert.currentValue,
            alert.triggeredAt
          );
        }

        triggered.push(alert);
      }
    }

    return triggered;
  }

  // Get active alerts
  static getActiveAlerts(severity?: AlertSeverity): Alert[] {
    if (!db) return [];

    let query = `SELECT * FROM alerts WHERE status = 'active'`;
    const params: (string | number)[] = [];

    if (severity) {
      query += ` AND severity = ?`;
      params.push(severity);
    }

    query += ` ORDER BY triggered_at DESC`;

    const rows = db.prepare(query).all(...params) as Array<{
      id: string;
      name: string;
      severity: AlertSeverity;
      status: AlertStatus;
      message: string;
      metric_id: string;
      threshold: number;
      current_value: number;
      triggered_at: number;
      acknowledged_at?: number;
      acknowledged_by?: string;
      resolved_at?: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      severity: row.severity,
      status: row.status,
      message: row.message,
      metricId: row.metric_id,
      threshold: row.threshold,
      currentValue: row.current_value,
      triggeredAt: row.triggered_at,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
      resolvedAt: row.resolved_at
    }));
  }

  // Acknowledge alert
  static acknowledgeAlert(alertId: string, userId: string): void {
    if (!db) return;

    db.prepare(`
      UPDATE alerts 
      SET status = 'acknowledged', acknowledged_at = ?, acknowledged_by = ?
      WHERE id = ?
    `).run(Date.now(), userId, alertId);
  }

  // Resolve alert
  static resolveAlert(alertId: string): void {
    if (!db) return;

    db.prepare(`
      UPDATE alerts 
      SET status = 'resolved', resolved_at = ?
      WHERE id = ?
    `).run(Date.now(), alertId);
  }
}

// Business Intelligence
export class BusinessIntelligence {
  // Generate usage report
  static generateUsageReport(startDate: string, endDate: string): {
    totalCalls: number;
    uniqueUsers: number;
    toolBreakdown: Array<{ tool: string; calls: number; percentage: number }>;
    dailyTrend: Array<{ date: string; calls: number }>;
    conversionRate: number;
    topWorkspaces: Array<{ workspaceId: string; calls: number }>;
  } {
    if (!db) {
      return {
        totalCalls: 0,
        uniqueUsers: 0,
        toolBreakdown: [],
        dailyTrend: [],
        conversionRate: 0,
        topWorkspaces: []
      };
    }

    // Total calls
    const totalCalls = db.prepare(`
      SELECT SUM(usage_count) as total FROM license_usage WHERE date BETWEEN ? AND ?
    `).get(startDate, endDate) as { total: number } || { total: 0 };

    // Unique users
    const uniqueUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM license_usage WHERE date BETWEEN ? AND ?
    `).get(startDate, endDate) as { count: number } || { count: 0 };

    // Tool breakdown
    const toolStats = db.prepare(`
      SELECT feature as tool, SUM(usage_count) as calls
      FROM license_usage
      WHERE date BETWEEN ? AND ?
      GROUP BY feature
      ORDER BY calls DESC
    `).all(startDate, endDate) as Array<{ tool: string; calls: number }>;

    const total = totalCalls.total || 1;
    const toolBreakdown = toolStats.map(t => ({
      tool: t.tool,
      calls: t.calls,
      percentage: Math.round((t.calls / total) * 100)
    }));

    // Daily trend
    const dailyTrend = db.prepare(`
      SELECT date, SUM(usage_count) as calls
      FROM license_usage
      WHERE date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date
    `).all(startDate, endDate) as Array<{ date: string; calls: number }>;

    // Top workspaces (using workspace analytics)
    const topWorkspaces = db.prepare(`
      SELECT workspace_id, api_calls_today as calls
      FROM workspace_resource_usage
      ORDER BY api_calls_today DESC
      LIMIT 5
    `).all() as Array<{ workspace_id: string; calls: number }>;

    // Calculate conversion rate (paid users / total users)
    const totalUsers = db.prepare(`SELECT COUNT(*) as count FROM rbac_roles`).get() as { count: number } || { count: 0 };
    const paidUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM rbac_roles 
      WHERE role IN ('admin', 'manager', 'pro_user')
    `).get() as { count: number } || { count: 0 };

    const conversionRate = totalUsers.count > 0 
      ? Math.round((paidUsers.count / totalUsers.count) * 100) 
      : 0;

    return {
      totalCalls: totalCalls.total || 0,
      uniqueUsers: uniqueUsers.count || 0,
      toolBreakdown,
      dailyTrend,
      conversionRate,
      topWorkspaces: topWorkspaces.map(w => ({ workspaceId: w.workspace_id, calls: w.calls }))
    };
  }

  // Predict growth
  static predictGrowth(days: number = 30): {
    predictedUsers: number;
    predictedRevenue: number;
    confidence: number;
    factors: Array<{ name: string; impact: number }>;
  } {
    if (!db) {
      return {
        predictedUsers: 0,
        predictedRevenue: 0,
        confidence: 0,
        factors: []
      };
    }

    // Get historical growth
    const dailyGrowth = db.prepare(`
      SELECT date, COUNT(DISTINCT user_id) as new_users
      FROM license_usage
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `).all() as Array<{ date: string; new_users: number }>;

    if (dailyGrowth.length < 7) {
      return {
        predictedUsers: 0,
        predictedRevenue: 0,
        confidence: 0,
        factors: [{ name: 'insufficient_data', impact: 0 }]
      };
    }

    // Calculate average daily growth
    const avgDailyGrowth = dailyGrowth.reduce((sum, d) => sum + d.new_users, 0) / dailyGrowth.length;
    
    // Current user count
    const currentUsers = db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM license_usage`).get() as { count: number } || { count: 0 };
    
    // Predicted users (simple linear projection)
    const predictedUsers = Math.round(currentUsers.count + (avgDailyGrowth * days));
    
    // Assume 15% paid conversion at $15 average
    const predictedPaidUsers = Math.round(predictedUsers * 0.15);
    const predictedRevenue = predictedPaidUsers * 15;

    // Confidence based on data quality
    const confidence = Math.min(95, dailyGrowth.length * 3);

    return {
      predictedUsers,
      predictedRevenue,
      confidence,
      factors: [
        { name: 'current_growth_rate', impact: Math.round(avgDailyGrowth * 10) },
        { name: 'market_trends', impact: 5 },
        { name: 'seasonality', impact: -2 }
      ]
    };
  }
}

// Capacity Planner
export class CapacityPlanner {
  // Analyze current capacity
  static analyzeCapacity(): Array<{
    resourceType: string;
    currentUsage: number;
    capacityLimit: number;
    utilizationPercent: number;
    daysUntilFull: number | null;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    if (!db) return [];

    const resources: Array<{
      resourceType: string;
      currentUsage: number;
      capacityLimit: number;
      utilizationPercent: number;
      daysUntilFull: number | null;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    }> = [];

    // Check storage across all workspaces
    const storageStats = db.prepare(`
      SELECT SUM(storage_bytes) as used, MAX(100000000) as limit
      FROM workspace_resource_usage
    `).get() as { used: number; limit: number } | undefined;

    if (storageStats) {
      const used = storageStats.used || 0;
      const limit = storageStats.limit || 100000000;
      const utilization = (used / limit) * 100;
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (utilization > 95) riskLevel = 'critical';
      else if (utilization > 80) riskLevel = 'high';
      else if (utilization > 60) riskLevel = 'medium';

      // Estimate days until full (assuming 5% daily growth)
      const dailyGrowth = used * 0.05;
      const daysUntilFull = dailyGrowth > 0 ? Math.floor((limit - used) / dailyGrowth) : null;

      resources.push({
        resourceType: 'storage',
        currentUsage: used,
        capacityLimit: limit,
        utilizationPercent: Math.round(utilization * 10) / 10,
        daysUntilFull,
        riskLevel
      });
    }

    // Check API call capacity
    const apiStats = db.prepare(`
      SELECT SUM(api_calls_today) as used, SUM(api_calls_limit) as limit
      FROM workspace_resource_usage w
      JOIN workspaces ws ON w.workspace_id = ws.id
    `).get() as { used: number; limit: number } | undefined;

    if (apiStats) {
      const used = apiStats.used || 0;
      const limit = apiStats.limit || 1000000;
      const utilization = (used / limit) * 100;

      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (utilization > 90) riskLevel = 'critical';
      else if (utilization > 70) riskLevel = 'high';
      else if (utilization > 50) riskLevel = 'medium';

      resources.push({
        resourceType: 'api_calls',
        currentUsage: used,
        capacityLimit: limit,
        utilizationPercent: Math.round(utilization * 10) / 10,
        daysUntilFull: null, // Daily reset
        riskLevel
      });
    }

    // Check database size
    const dbStats = db.prepare(`
      SELECT page_count * page_size as size
      FROM pragma_page_count(), pragma_page_size()
    `).get() as { size: number } | undefined;

    if (dbStats) {
      const size = dbStats.size;
      const limit = 10 * 1024 * 1024 * 1024; // 10GB assumed limit
      const utilization = (size / limit) * 100;

      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (utilization > 90) riskLevel = 'critical';
      else if (utilization > 75) riskLevel = 'high';
      else if (utilization > 50) riskLevel = 'medium';

      resources.push({
        resourceType: 'database',
        currentUsage: size,
        capacityLimit: limit,
        utilizationPercent: Math.round(utilization * 10) / 10,
        daysUntilFull: null,
        riskLevel
      });
    }

    return resources;
  }

  // Get recommendations
  static getRecommendations(): Array<{
    resource: string;
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedImpact: string;
  }> {
    const capacity = this.analyzeCapacity();
    const recommendations: Array<{
      resource: string;
      action: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      estimatedImpact: string;
    }> = [];

    for (const resource of capacity) {
      if (resource.riskLevel === 'critical') {
        recommendations.push({
          resource: resource.resourceType,
          action: 'Immediate scaling required - add capacity within 24 hours',
          priority: 'critical',
          estimatedImpact: 'Prevents service outage'
        });
      } else if (resource.riskLevel === 'high') {
        recommendations.push({
          resource: resource.resourceType,
          action: 'Plan capacity expansion within 7 days',
          priority: 'high',
          estimatedImpact: `Maintains ${resource.daysUntilFull} days of headroom`
        });
      } else if (resource.riskLevel === 'medium') {
        recommendations.push({
          resource: resource.resourceType,
          action: 'Monitor and prepare scaling plan',
          priority: 'medium',
          estimatedImpact: 'Proactive capacity management'
        });
      }
    }

    return recommendations;
  }
}

// Register monitoring tools
export function registerMonitoringTools(server: McpServer, license: LicenseInfo) {
  // Initialize tables
  PerformanceMonitor.initializeTables();

  // Setup default alert rules
  AlertManager.addAlertRule('high_cpu', 'cpu_usage', 80, 'gt', AlertSeverity.WARNING, 'CPU usage is high: {value}%');
  AlertManager.addAlertRule('critical_cpu', 'cpu_usage', 95, 'gt', AlertSeverity.CRITICAL, 'CPU usage is critical: {value}%');
  AlertManager.addAlertRule('high_memory', 'memory_usage', 85, 'gt', AlertSeverity.WARNING, 'Memory usage is high: {value}%');
  AlertManager.addAlertRule('high_latency', 'api_latency', 1000, 'gt', AlertSeverity.WARNING, 'API latency is high: {value}ms');
  AlertManager.addAlertRule('error_rate', 'error_rate', 5, 'gt', AlertSeverity.CRITICAL, 'Error rate is elevated: {value}%');

  server.tool(
    "monitoring_record_metric",
    "Record a performance or business metric.",
    {
      name: z.string().describe("Metric name (e.g., 'api_latency', 'active_users')"),
      value: z.number().describe("Metric value"),
      unit: z.string().default("count").describe("Unit of measurement"),
      type: z.enum(["performance", "usage", "error", "capacity", "business"]).default("performance").describe("Metric type"),
      labels: z.record(z.string()).optional().describe("Additional labels/tags"),
    },
    withErrorHandling(async ({ name, value, unit, type, labels }) => {
      const metric = PerformanceMonitor.recordMetric({
        name,
        type: type as MetricType,
        value,
        unit,
        labels
      });

      // Check if this triggers any alerts
      const alerts = AlertManager.checkAlerts(metric);

      return {
        content: [{
          type: "text",
          text: `Metric recorded: ${name} = ${value} ${unit}\n` +
               `Type: ${type}\n` +
               `ID: ${metric.id}\n` +
               (alerts.length > 0 ? `\n⚠️ ${alerts.length} alert(s) triggered!` : '')
        }]
      };
    })
  );

  server.tool(
    "monitoring_get_metrics",
    "Get current metrics and historical data.",
    {
      name: z.string().optional().describe("Filter by metric name"),
      type: z.enum(["performance", "usage", "error", "capacity", "business"]).optional().describe("Filter by metric type"),
      limit: z.number().default(100).describe("Number of metrics to return"),
    },
    withErrorHandling(async ({ name, type, limit }) => {
      if (!db) throw new Error("Database not initialized");

      let query = `SELECT * FROM metrics WHERE 1=1`;
      const params: (string | number)[] = [];

      if (name) {
        query += ` AND name = ?`;
        params.push(name);
      }

      if (type) {
        query += ` AND type = ?`;
        params.push(type);
      }

      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(Math.min(limit, 1000));

      const metrics = db.prepare(query).all(...params) as Array<{
        id: string;
        name: string;
        type: string;
        value: number;
        unit: string;
        timestamp: number;
        labels?: string;
      }>;

      if (metrics.length === 0) {
        return {
          content: [{ type: "text", text: "No metrics found matching the criteria." }]
        };
      }

      const summary = metrics.slice(0, 20).map(m => 
        `${new Date(m.timestamp).toISOString()} | ${m.name}: ${m.value} ${m.unit}`
      ).join('\n');

      return {
        content: [{
          type: "text",
          text: `Metrics (${metrics.length} total):\n\n${summary}\n\n` +
               (metrics.length > 20 ? `... and ${metrics.length - 20} more` : '')
        }]
      };
    })
  );

  server.tool(
    "monitoring_get_alerts",
    "Get active alerts and manage alert status.",
    {
      severity: z.enum(["info", "warning", "critical"]).optional().describe("Filter by severity"),
      status: z.enum(["active", "acknowledged", "resolved"]).default("active").describe("Alert status filter"),
      limit: z.number().default(50).describe("Max alerts to return"),
    },
    withErrorHandling(async ({ severity, status, limit }) => {
      if (!db) throw new Error("Database not initialized");

      let query = `SELECT * FROM alerts WHERE status = ?`;
      const params: (string | number)[] = [status];

      if (severity) {
        query += ` AND severity = ?`;
        params.push(severity);
      }

      query += ` ORDER BY triggered_at DESC LIMIT ?`;
      params.push(Math.min(limit, 100));

      const alerts = db.prepare(query).all(...params) as Array<{
        id: string;
        name: string;
        severity: string;
        status: string;
        message: string;
        threshold: number;
        current_value: number;
        triggered_at: number;
      }>;

      if (alerts.length === 0) {
        return {
          content: [{ type: "text", text: `No ${status} alerts found.` }]
        };
      }

      const alertList = alerts.map(a => {
        const emoji = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵';
        return `${emoji} ${a.name}\n   ${a.message}\n   Threshold: ${a.threshold}, Current: ${a.current_value}`;
      }).join('\n\n');

      return {
        content: [{
          type: "text",
          text: `${status.toUpperCase()} Alerts (${alerts.length}):\n\n${alertList}`
        }]
      };
    })
  );

  server.tool(
    "monitoring_acknowledge_alert",
    "Acknowledge an active alert.",
    {
      alert_id: z.string().describe("Alert ID to acknowledge"),
      user_id: z.string().describe("User acknowledging the alert"),
    },
    withErrorHandling(async ({ alert_id, user_id }) => {
      AlertManager.acknowledgeAlert(alert_id, user_id);

      return {
        content: [{
          type: "text",
          text: `Alert ${alert_id} acknowledged by ${user_id}`
        }]
      };
    })
  );

  server.tool(
    "monitoring_business_report",
    "Generate business intelligence reports.",
    {
      start_date: z.string().describe("Report start date (YYYY-MM-DD)"),
      end_date: z.string().describe("Report end date (YYYY-MM-DD)"),
      report_type: z.enum(["usage", "growth", "revenue"]).default("usage").describe("Type of report"),
    },
    withErrorHandling(async ({ start_date, end_date, report_type }) => {
      if (report_type === 'usage') {
        const report = BusinessIntelligence.generateUsageReport(start_date, end_date);

        const toolBreakdown = report.toolBreakdown.map(t => 
          `  ${t.tool}: ${t.calls} calls (${t.percentage}%)`
        ).join('\n') || '  No data';

        const topWorkspaces = report.topWorkspaces.map(w => 
          `  ${w.workspaceId}: ${w.calls} calls`
        ).join('\n') || '  No data';

        return {
          content: [{
            type: "text",
            text: `📊 Usage Report (${start_date} to ${end_date})\n\n` +
                 `Total API Calls: ${report.totalCalls.toLocaleString()}\n` +
                 `Unique Users: ${report.uniqueUsers.toLocaleString()}\n` +
                 `Conversion Rate: ${report.conversionRate}%\n\n` +
                 `Tool Breakdown:\n${toolBreakdown}\n\n` +
                 `Top Workspaces:\n${topWorkspaces}`
          }]
        };
      } else if (report_type === 'growth') {
        const prediction = BusinessIntelligence.predictGrowth(30);

        return {
          content: [{
            type: "text",
            text: `📈 Growth Prediction (30 days)\n\n` +
                 `Predicted Users: ${prediction.predictedUsers.toLocaleString()}\n` +
                 `Predicted Revenue: $${prediction.predictedRevenue.toLocaleString()}/mo\n` +
                 `Confidence: ${prediction.confidence}%\n\n` +
                 `Key Factors:\n` +
                 prediction.factors.map(f => `  - ${f.name}: ${f.impact > 0 ? '+' : ''}${f.impact}%`).join('\n')
          }]
        };
      }

      return {
        content: [{ type: "text", text: `Report type '${report_type}' generated.` }]
      };
    })
  );

  server.tool(
    "monitoring_capacity_analysis",
    "Analyze current capacity and get scaling recommendations.",
    {},
    withErrorHandling(async () => {
      const capacity = CapacityPlanner.analyzeCapacity();
      const recommendations = CapacityPlanner.getRecommendations();

      if (capacity.length === 0) {
        return {
          content: [{ type: "text", text: "No capacity data available. Start recording metrics first." }]
        };
      }

      const resourceStatus = capacity.map(r => {
        const emoji = r.riskLevel === 'critical' ? '🔴' : r.riskLevel === 'high' ? '🟠' : r.riskLevel === 'medium' ? '🟡' : '🟢';
        const daysInfo = r.daysUntilFull ? ` (${r.daysUntilFull} days until full)` : '';
        return `${emoji} ${r.resourceType}: ${r.utilizationPercent}% used${daysInfo}`;
      }).join('\n');

      const recs = recommendations.length > 0 
        ? '\n\nRecommendations:\n' + recommendations.map(r => 
            `${r.priority === 'critical' ? '🔴' : r.priority === 'high' ? '🟠' : '🟡'} ${r.resource}: ${r.action}`
          ).join('\n')
        : '\n\n✅ All resources at healthy levels';

      return {
        content: [{
          type: "text",
          text: `📊 Capacity Analysis\n\n${resourceStatus}${recs}`
        }]
      };
    })
  );

  server.tool(
    "monitoring_system_status",
    "Get overall system health and monitoring overview.",
    {},
    withErrorHandling(async () => {
      const metrics = PerformanceMonitor.getCurrentMetrics();
      const activeAlerts = db ? db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE status = 'active'`).get() as { count: number } : { count: 0 };
      const criticalAlerts = db ? db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE status = 'active' AND severity = 'critical'`).get() as { count: number } : { count: 0 };

      const capacity = CapacityPlanner.analyzeCapacity();
      const hasCriticalCapacity = capacity.some(c => c.riskLevel === 'critical');

      let status = '🟢 Healthy';
      if (criticalAlerts.count > 0 || hasCriticalCapacity) {
        status = '🔴 Critical';
      } else if (activeAlerts.count > 5 || capacity.some(c => c.riskLevel === 'high')) {
        status = '🟠 Warning';
      } else if (activeAlerts.count > 0) {
        status = '🟡 Degraded';
      }

      return {
        content: [{
          type: "text",
          text: `🔍 System Status: ${status}\n\n` +
               `Active Metrics: ${metrics.length}\n` +
               `Active Alerts: ${activeAlerts.count} (${criticalAlerts.count} critical)\n` +
               `Resources Monitored: ${capacity.length}\n\n` +
               `Use monitoring_get_alerts for details on active alerts.\n` +
               `Use monitoring_capacity_analysis for resource details.`
        }]
      };
    })
  );
}
