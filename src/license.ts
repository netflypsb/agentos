// Basic license system for AgentOS MCP Server

export enum LicenseTier {
  FREE = "free",
  PRO = "pro",
  TEAM = "team",
  ENTERPRISE = "enterprise"
}

export interface LicenseInfo {
  tier: LicenseTier;
  isValid: boolean;
  expiresAt?: Date;
  features: string[];
  limits: {
    dailyLogs: number;
    maxStorage: number; // MB
    maxWorkspaces: number;
  };
}

export class LicenseManager {
  private static cache = new Map<string, { license: LicenseInfo; timestamp: number }>();
  private static readonly CACHE_TTL = 300000; // 5 minutes

  static async validateLicense(licenseKey?: string): Promise<LicenseInfo> {
    // If no license key provided, return free tier
    if (!licenseKey) {
      return this.getFreeTierLicense();
    }

    // Check cache first
    const cached = this.cache.get(licenseKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.license;
    }

    try {
      // Validate license key format
      const license = await this.validateLicenseKey(licenseKey);
      
      // Cache the result
      this.cache.set(licenseKey, {
        license,
        timestamp: Date.now()
      });

      return license;
    } catch (error) {
      console.error('License validation failed:', error);
      return this.getFreeTierLicense();
    }
  }

  private static getFreeTierLicense(): LicenseInfo {
    return {
      tier: LicenseTier.FREE,
      isValid: true,
      features: [
        "kv_store",
        "format_convert", 
        "agent_log_limited"
      ],
      limits: {
        dailyLogs: 100,
        maxStorage: 100, // 100MB
        maxWorkspaces: 1
      }
    };
  }

  private static async validateLicenseKey(key: string): Promise<LicenseInfo> {
    // Basic license key format validation
    if (!this.isValidLicenseKeyFormat(key)) {
      throw new Error('Invalid license key format');
    }

    // For now, simulate license validation
    // In production, this would call MCP Marketplace API
    return this.simulateLicenseValidation(key);
  }

  private static isValidLicenseKeyFormat(key: string): boolean {
    // License keys should be 32 characters, alphanumeric
    return /^[A-Za-z0-9]{32}$/.test(key);
  }

  private static simulateLicenseValidation(key: string): LicenseInfo {
    // Simulate different license tiers based on key patterns
    // This is for development/testing only
    
    const firstChar = key.charAt(0).toLowerCase();
    
    switch (firstChar) {
      case 'p': // Pro tier keys start with 'p'
        return {
          tier: LicenseTier.PRO,
          isValid: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          features: [
            "kv_store",
            "format_convert",
            "agent_log_unlimited",
            "task_ledger",
            "budget_guard",
            "template_engine"
          ],
          limits: {
            dailyLogs: Infinity,
            maxStorage: 1000, // 1GB
            maxWorkspaces: 5
          }
        };
        
      case 't': // Team tier keys start with 't'
        return {
          tier: LicenseTier.TEAM,
          isValid: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          features: [
            "kv_store",
            "format_convert", 
            "agent_log_unlimited",
            "task_ledger",
            "budget_guard",
            "template_engine",
            "workspace_management",
            "team_analytics"
          ],
          limits: {
            dailyLogs: Infinity,
            maxStorage: 5000, // 5GB
            maxWorkspaces: 20
          }
        };
        
      case 'e': // Enterprise tier keys start with 'e'
        return {
          tier: LicenseTier.ENTERPRISE,
          isValid: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          features: [
            "kv_store",
            "format_convert",
            "agent_log_unlimited", 
            "task_ledger",
            "budget_guard",
            "template_engine",
            "workspace_management",
            "team_analytics",
            "sso_integration",
            "audit_logs",
            "custom_templates",
            "api_management"
          ],
          limits: {
            dailyLogs: Infinity,
            maxStorage: 50000, // 50GB
            maxWorkspaces: Infinity
          }
        };
        
      default:
        // Invalid key format, return free tier
        return this.getFreeTierLicense();
    }
  }

  static hasFeature(license: LicenseInfo, feature: string): boolean {
    return license.features.includes(feature);
  }

  static canUseFeature(license: LicenseInfo, feature: string, currentUsage?: number): boolean {
    if (!this.hasFeature(license, feature)) {
      return false;
    }

    // Check limits for specific features
    switch (feature) {
      case "agent_log_unlimited":
        return true; // Unlimited for paid tiers
        
      case "agent_log_limited":
        if (currentUsage && license.limits.dailyLogs !== Infinity) {
          return currentUsage < license.limits.dailyLogs;
        }
        return true;
        
      default:
        return true;
    }
  }

  static getUpgradePrompt(license: LicenseInfo): string {
    switch (license.tier) {
      case LicenseTier.FREE:
        return "🚀 Upgrade to Pro for unlimited logging and advanced features. Visit https://mcp-marketplace.io/agentos-mcp";
      case LicenseTier.PRO:
        return "👥 Upgrade to Team for workspace management and collaboration features. Visit https://mcp-marketplace.io/agentos-mcp";
      case LicenseTier.TEAM:
        return "🏢 Contact us for Enterprise features including SSO and custom integrations. Visit https://agentos-mcp.com/enterprise";
      default:
        return "";
    }
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size
    };
  }
}

// Usage tracking for free tier limits
export class UsageTracker {
  private static db: any;

  static initialize(db: any): void {
    this.db = db;
    
    // Create usage tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        feature TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        last_updated INTEGER DEFAULT (unixepoch()),
        UNIQUE(date, feature)
      );
    `);
  }

  static trackUsage(feature: string): void {
    if (!this.db) return;

    const today = new Date().toISOString().split('T')[0];
    
    this.db.prepare(`
      INSERT INTO usage_tracking (date, feature, usage_count, last_updated)
      VALUES (?, ?, 1, unixepoch())
      ON CONFLICT(date, feature) DO UPDATE SET
        usage_count = usage_count + 1,
        last_updated = unixepoch()
    `).run(today, feature);
  }

  static getDailyUsage(feature: string, date?: string): number {
    if (!this.db) return 0;

    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const result = this.db.prepare(`
      SELECT usage_count FROM usage_tracking 
      WHERE date = ? AND feature = ?
    `).get(targetDate, feature);

    return result?.usage_count || 0;
  }

  static cleanupOldUsage(daysToKeep: number = 30): void {
    if (!this.db) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    this.db.prepare(`
      DELETE FROM usage_tracking WHERE date < ?
    `).run(cutoff);
  }
}
