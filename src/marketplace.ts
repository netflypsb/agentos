// MCP Marketplace SDK Integration for AgentOS
// Simulates the @mcp_marketplace/license package functionality

import { LicenseTier, LicenseInfo } from "./license.js";

export interface MarketplaceConfig {
  slug: string;
  paidTools: string[];
  freeTools: string[];
  revenueSplit: { developer: number; marketplace: number };
}

export interface ValidationResponse {
  valid: boolean;
  tier: LicenseTier;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  features: string[];
  error?: string;
}

// Marketplace configuration
export const marketplaceConfig: MarketplaceConfig = {
  slug: "agentos",
  paidTools: [
    "task_ledger",
    "budget_guard", 
    "template_engine",
    "agent_log_unlimited",
    "workspace_management",
    "team_analytics"
  ],
  freeTools: [
    "format_convert",
    "kv_store",
    "agent_log_limited"
  ],
  revenueSplit: { developer: 85, marketplace: 15 }
};

// MCP Marketplace License Manager
export class McpMarketplaceLicense {
  // MCP Marketplace API endpoint (used in production)
  // private static apiEndpoint = "https://api.mcp-marketplace.io/v1";
  private static validationCache = new Map<string, { response: ValidationResponse; timestamp: number }>();
  private static readonly CACHE_TTL = 60000; // 1 minute for faster validation
  private static readonly GRACE_PERIOD_DAYS = 3;

  // Validate license with MCP Marketplace API
  static async validateLicense(licenseKey: string): Promise<ValidationResponse> {
    const startTime = Date.now();
    
    // Check cache first
    const cached = this.validationCache.get(licenseKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.response;
    }

    try {
      // Simulate API call to MCP Marketplace
      // In production, this would be: fetch(`${this.apiEndpoint}/validate`, {...})
      const response = await this.simulateMarketplaceValidation(licenseKey);
      
      // Cache the result
      this.validationCache.set(licenseKey, {
        response,
        timestamp: Date.now()
      });

      const validationTime = Date.now() - startTime;
      if (validationTime > 500) {
        console.warn(`License validation took ${validationTime}ms (target: <500ms)`);
      }

      return response;
    } catch (error) {
      return {
        valid: false,
        tier: LicenseTier.FREE,
        features: marketplaceConfig.freeTools,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  // Simulate marketplace API validation
  private static async simulateMarketplaceValidation(key: string): Promise<ValidationResponse> {
    // Validate key format
    if (!/^[A-Za-z0-9]{32}$/.test(key)) {
      return {
        valid: false,
        tier: LicenseTier.FREE,
        features: marketplaceConfig.freeTools,
        error: 'Invalid license key format'
      };
    }

    // Simulate network delay (50-150ms for realistic simulation)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    const firstChar = key.charAt(0).toLowerCase();
    const now = new Date();

    switch (firstChar) {
      case 'p':
        return {
          valid: true,
          tier: LicenseTier.PRO,
          expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          features: [
            ...marketplaceConfig.freeTools,
            ...marketplaceConfig.paidTools.filter(t => 
              !['workspace_management', 'team_analytics'].includes(t)
            )
          ]
        };

      case 't':
        return {
          valid: true,
          tier: LicenseTier.TEAM,
          expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          features: [
            ...marketplaceConfig.freeTools,
            ...marketplaceConfig.paidTools
          ]
        };

      case 'e':
        return {
          valid: true,
          tier: LicenseTier.ENTERPRISE,
          expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          features: [
            ...marketplaceConfig.freeTools,
            ...marketplaceConfig.paidTools,
            'sso_integration',
            'audit_logs',
            'custom_templates',
            'api_management'
          ]
        };

      default:
        return {
          valid: false,
          tier: LicenseTier.FREE,
          features: marketplaceConfig.freeTools,
          error: 'Unknown license key prefix'
        };
    }
  }

  // Check if license is in grace period
  static isInGracePeriod(license: LicenseInfo): boolean {
    if (!license.expiresAt) return false;
    
    const now = new Date();
    const gracePeriodEnd = new Date(license.expiresAt.getTime() + this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    
    return now > license.expiresAt && now <= gracePeriodEnd;
  }

  // Get grace period remaining days
  static getGracePeriodRemaining(license: LicenseInfo): number | null {
    if (!license.expiresAt || !this.isInGracePeriod(license)) return null;
    
    const now = new Date();
    const gracePeriodEnd = new Date(license.expiresAt.getTime() + this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    return Math.max(0, remaining);
  }

  // Check if feature requires paid license
  static isPaidFeature(feature: string): boolean {
    return marketplaceConfig.paidTools.includes(feature);
  }

  // Get upgrade URL
  static getUpgradeUrl(currentTier: LicenseTier): string {
    const baseUrl = `https://mcp-marketplace.io/${marketplaceConfig.slug}`;
    
    switch (currentTier) {
      case LicenseTier.FREE:
        return `${baseUrl}/upgrade/pro`;
      case LicenseTier.PRO:
        return `${baseUrl}/upgrade/team`;
      case LicenseTier.TEAM:
        return `${baseUrl}/contact/enterprise`;
      default:
        return baseUrl;
    }
  }

  // Clear validation cache
  static clearCache(): void {
    this.validationCache.clear();
  }

  // Get cache statistics
  static getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.validationCache.size,
      hitRate: 0 // Would track in production
    };
  }
}

// License gating decorator for tools
export function withLicenseCheck(
  feature: string, 
  getLicense: () => Promise<LicenseInfo>
) {
  return async function<T extends (...args: any[]) => any>(
    fn: T,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> {
    const license = await getLicense();
    
    // Check if feature is available
    if (!license.features.includes(feature)) {
      throw new Error(
        `Feature "${feature}" requires a paid license. ` +
        `Upgrade at: ${McpMarketplaceLicense.getUpgradeUrl(license.tier)}`
      );
    }

    // Check if license is expired but in grace period
    if (license.expiresAt && new Date() > license.expiresAt) {
      if (McpMarketplaceLicense.isInGracePeriod(license)) {
        const remaining = McpMarketplaceLicense.getGracePeriodRemaining(license);
        console.warn(`License expired. Grace period: ${remaining} days remaining.`);
      } else {
        throw new Error(
          `License expired. Please renew at: ${McpMarketplaceLicense.getUpgradeUrl(license.tier)}`
        );
      }
    }

    return fn(...args);
  };
}

// Export marketplace configuration
export { marketplaceConfig as config };
