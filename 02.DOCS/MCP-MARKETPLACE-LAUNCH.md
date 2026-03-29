# MCP Marketplace Launch Guide for AgentOS

## Overview

This guide walks you through launching AgentOS on the MCP Marketplace. The marketplace lets developers discover, install, and pay for MCP servers that extend AI capabilities.

**Time to Launch:** 5-7 days  
**Revenue Model:** 85% to developer, 15% marketplace fee  
**Pricing:** Freemium with paid tiers (Pro $15/mo, Team $49/mo)

---

## Pre-Launch Checklist

### Phase 1: Account & SDK Setup (Day 1)

#### 1.1 Create MCP Marketplace Account

```bash
# Step 1: Visit marketplace portal
# URL: https://mcp-marketplace.io/creators

# Step 2: Sign up with:
# - Email: (your business email)
# - Creator Name: AgentOS Team
# - Company: (your company or personal name)
# - Tax Info: (required for payouts)

# Step 3: Verify email and complete KYC
# - Upload ID verification
# - Add payout method (PayPal or Bank Transfer)
# - Accept marketplace terms
```

#### 1.2 Install MCP SDK

```bash
# Install the official MCP Marketplace SDK
npm install @mcp-marketplace/license

# Or add to package.json:
# "@mcp-marketplace/license": "^1.0.0"
```

#### 1.3 SDK Integration

Add license validation to your existing `src/marketplace.ts`:

```typescript
import { McpLicenseValidator } from "@mcp-marketplace/license";
import { db } from "./db.js";

// Initialize validator
const validator = new McpLicenseValidator({
  slug: "agentos",           // Your marketplace slug
  apiKey: process.env.MCP_MARKETPLACE_API_KEY,  // From creator dashboard
  environment: "production"
});

// Validate license on tool usage
export async function validateLicense(
  licenseKey: string, 
  feature: string
): Promise<{ valid: boolean; tier: string; expiresAt?: number }> {
  // Check cache first (1 minute TTL)
  const cached = getCachedLicense(licenseKey);
  if (cached && cached.timestamp > Date.now() - 60000) {
    return { 
      valid: cached.tier !== "FREE", 
      tier: cached.tier,
      expiresAt: cached.expiresAt 
    };
  }

  // Validate with marketplace API
  const result = await validator.validate({
    licenseKey,
    feature,
    timestamp: Date.now()
  });

  // Cache result
  cacheLicense(licenseKey, result);

  return result;
}

// Grace period handling (3 days after expiration)
export function isInGracePeriod(expiresAt: number): boolean {
  const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
  return Date.now() < expiresAt + GRACE_PERIOD_MS;
}
```

---

### Phase 2: Tool Gating Configuration (Day 2)

#### 2.1 Define Free vs Paid Tools

Update `src/marketplace.ts` with your feature gating:

```typescript
// Free tier tools (always available)
export const FREE_TOOLS = [
  "kv_set", "kv_get", "kv_delete", "kv_list",
  "format_convert",
  "log_action", "log_search", "log_export",
  "support_knowledge_base"
];

// Pro tier tools ($15/mo)
export const PRO_TOOLS = [
  "task_create", "task_checkpoint", "task_rollback",
  "task_status", "task_complete", "task_list",
  "budget_set", "budget_consume", "budget_check",
  "budget_status", "loop_detect",
  "template_list", "template_render", "template_create",
  "analytics_dashboard", "analytics_report"
];

// Team tier tools ($49/mo, 5 users)
export const TEAM_TOOLS = [
  ...PRO_TOOLS,
  "workspace_create", "workspace_add_member", "workspace_remove_member",
  "workspace_set_value", "workspace_get_value", "workspace_list_values",
  "workspace_analytics", "workspace_list",
  "rbac_assign_role", "rbac_revoke_role", "rbac_check_permission"
];

// Enterprise tier (custom pricing)
export const ENTERPRISE_TOOLS = [
  ...TEAM_TOOLS,
  "audit_query_logs", "compliance_generate_report",
  "enterprise_status", "enterprise_encrypt", "enterprise_decrypt",
  "monitoring_record_metric", "monitoring_get_metrics",
  "monitoring_get_alerts", "monitoring_acknowledge_alert",
  "monitoring_business_report", "monitoring_capacity_analysis",
  "monitoring_system_status"
];
```

#### 2.2 Implement Tool Gating Middleware

```typescript
// Add to each paid tool handler
server.tool(
  "task_create",
  "Create a new task for tracking...",
  { /* schema */ },
  withErrorHandling(async (args, context) => {
    // Extract license from context (provided by marketplace client)
    const licenseKey = context.licenseKey;
    
    // Validate license
    const validation = await validateLicense(licenseKey, "task_create");
    
    if (!validation.valid) {
      // Check if in grace period
      if (validation.expiresAt && isInGracePeriod(validation.expiresAt)) {
        return {
          content: [{
            type: "text",
            text: `⚠️ License expired but in grace period. Renew at: https://mcp-marketplace.io/agentos/upgrade\n\n` +
                 `Creating task... (grace period expires in ${formatTimeLeft(validation.expiresAt + GRACE_PERIOD)})`
          }]
        };
      }
      
      // Block access with upgrade prompt
      return {
        content: [{
          type: "text",
          text: `🔒 This feature requires a Pro license ($15/mo)\n\n` +
               `Upgrade at: https://mcp-marketplace.io/agentos/upgrade\n\n` +
               `Free alternatives:\n` +
               `- Use kv_set to manually track tasks\n` +
               `- Use log_action to record progress`
        }],
        isError: true
      };
    }
    
    // Tool is licensed - execute
    return createTask(args);
  })
);
```

---

### Phase 3: Create Marketplace Listing (Day 3-4)

#### 3.1 Listing Content

```yaml
# marketplace-listing.yml
name: "AgentOS"
slug: "agentos"
tagline: "Operating System for AI Agents"
description: |
  AgentOS gives your AI agents persistent memory, task management, 
  and team collaboration capabilities. Think of it as infrastructure 
  for AI agents that never forget.

category: "Developer Tools"
tags:
  - memory
  - task-management
  - collaboration
  - productivity
  - enterprise

icon: ./assets/icon-512x512.png  # Required
screenshots:
  - ./assets/screenshot-1.png
  - ./assets/screenshot-2.png
  - ./assets/screenshot-3.png

video: "https://www.youtube.com/watch?v=..."  # Optional but recommended
```

#### 3.2 Required Assets

| Asset | Size | Purpose |
|-------|------|---------|
| Icon | 512x512 PNG | Listing thumbnail |
| Screenshot 1 | 1920x1080 | Dashboard/overview |
| Screenshot 2 | 1920x1080 | Key-value usage |
| Screenshot 3 | 1920x1080 | Task management |
| Demo Video | 2-3 min | Walkthrough |

#### 3.3 Create Demo Script

```typescript
// demo-script.ts - For your listing video
// Record this running in Claude/Cursor

async function demo() {
  console.log("🚀 AgentOS Demo");
  
  // 1. Persistent memory
  await kv_set({ key: "project_idea", value: "AI calendar assistant" });
  
  // 2. Days later...
  const idea = await kv_get({ key: "project_idea" });
  console.log("📌 Remembered:", idea);
  
  // 3. Complex task tracking
  const task = await task_create({ 
    session_id: "demo", 
    name: "Build landing page" 
  });
  
  await task_checkpoint({ 
    task_id: task.id, 
    state: { step: "design_complete" } 
  });
  
  // 4. Check what happened
  const logs = await log_search({ query: "landing page" });
  console.log("📊 Activity:", logs.length, "actions");
}
```

---

### Phase 4: Pricing Strategy (Day 5)

#### 4.1 Marketplace Pricing Setup

```yaml
# pricing.yml
plans:
  - name: "Free"
    price: 0
    description: "For hobbyists and experiments"
    features:
      - "1,000 API calls/month"
      - "100MB storage"
      - "Core tools only"
    
  - name: "Pro"
    price: 15
    billing: "monthly"
    description: "For professional developers"
    features:
      - "10,000 API calls/month"
      - "1GB storage"
      - "Task management"
      - "Budget tracking"
      - "Templates"
      - "Analytics"
      
  - name: "Team"
    price: 49
    billing: "monthly"
    description: "For small teams (5 users)"
    features:
      - "100,000 API calls/month"
      - "10GB storage"
      - "3 workspaces"
      - "Team collaboration"
      - "RBAC permissions"
      - "Shared templates"
      
  - name: "Enterprise"
    price: "contact_sales"
    description: "For large organizations"
    features:
      - "Unlimited API calls"
      - "Unlimited storage"
      - "Unlimited workspaces"
      - "Audit logging"
      - "Compliance reports"
      - "SSO/SAML"
      - "Priority support"
```

#### 4.2 Revenue Projections

| Tier | Price | Est. Customers | Monthly Revenue |
|------|-------|----------------|-----------------|
| Free | $0 | 1,000 | $0 |
| Pro | $15 | 100 | $1,500 |
| Team | $49 | 20 | $980 |
| Enterprise | Custom | 2 | $500+ |
| **Total** | | | **$2,980/mo** |
| **Your Cut (85%)** | | | **$2,533/mo** |

---

### Phase 5: Testing & Validation (Day 6)

#### 5.1 Pre-Launch Testing Checklist

```bash
# Test license validation
npm run test:license

# Test all free tools work without license
npm run test:free-tier

# Test paid tools blocked without license
npm run test:gating

# Test grace period handling
npm run test:grace-period

# Test upgrade flow
npm run test:upgrade

# Test analytics tracking
npm run test:analytics
```

#### 5.2 Test License Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| No license key | Free tools work, paid tools show upgrade prompt |
| Valid Pro license | All Pro tools work |
| Expired license (recent) | Grace period warning + limited access |
| Expired license (old) | Upgrade required message |
| Invalid license | Error with retry guidance |

---

### Phase 6: Launch Day (Day 7)

#### 6.1 Morning Checklist

```markdown
- [ ] Verify marketplace listing is "Approved" (not "Pending")
- [ ] Test purchase flow with test credit card
- [ ] Verify license emails are sending
- [ ] Check analytics dashboard is collecting data
- [ ] Ensure support channels are monitored
- [ ] Post to social media (Twitter, LinkedIn, Reddit r/ClaudeAI)
- [ ] Send email to existing beta users
```

#### 6.2 Launch Announcement Template

```markdown
🚀 Launching AgentOS on MCP Marketplace!

Give your AI agents persistent memory and task management.

✅ Never lose context between conversations
✅ Track complex multi-step tasks
✅ Collaborate with team workspaces

Free tier available. Pro starts at $15/mo.

Install: https://mcp-marketplace.io/agentos

#AI #MCP #Claude #Productivity
```

#### 6.3 Monitor Launch Metrics

Watch these in your creator dashboard:

| Metric | Target (Day 1) | Target (Week 1) |
|--------|----------------|-----------------|
| Listing Views | 100 | 1,000 |
| Free Installs | 20 | 200 |
| Paid Conversions | 2 | 20 |
| Support Tickets | <5 | <20 |
| Revenue | $30 | $300 |

---

## Post-Launch Optimization

### Week 1-2: Gather Feedback

```bash
# Review common questions
# - Add to FAQ in listing
# - Create knowledge base articles

# Track feature requests
# - Tally most-requested features
# - Prioritize for next release

# Monitor conversion funnel
# - Where do users drop off?
# - Optimize listing/description
```

### Week 3-4: Iterate

```bash
# A/B test listing elements
# - Different taglines
# - Screenshot variations
# - Pricing descriptions

# Optimize conversion
# - Add testimonials
# - Improve onboarding
# - Create video tutorials
```

---

## Common Issues & Solutions

### Issue: Low conversion rate
**Solution:** 
- Add more screenshots showing value
- Create 30-second demo video
- Offer 7-day free trial
- Add customer testimonials

### Issue: Support tickets about setup
**Solution:**
- Simplify installation docs
- Create quick-start guide
- Add troubleshooting FAQ
- Consider onboarding wizard

### Issue: License validation errors
**Solution:**
- Check API key is correct
- Verify network connectivity
- Add retry logic with exponential backoff
- Provide clear error messages

---

## Resources

- **MCP Marketplace Docs:** https://docs.mcp-marketplace.io
- **SDK Reference:** https://docs.mcp-marketplace.io/sdk
- **Creator Community:** https://community.mcp-marketplace.io
- **Support:** creators@mcp-marketplace.io

---

## Quick Reference

| Task | URL/Command |
|------|-------------|
| Creator Dashboard | https://mcp-marketplace.io/creators |
| Analytics | https://mcp-marketplace.io/creators/analytics |
| Payouts | https://mcp-marketplace.io/creators/payouts |
| Documentation | https://docs.mcp-marketplace.io |
| Test License | `npm run test:license` |
| Update Listing | Edit `marketplace-listing.yml` → Submit |

---

**Next Steps:**
1. ✅ Create marketplace account
2. ✅ Integrate SDK (already done in `src/marketplace.ts`)
3. 🔄 Create listing assets (icon, screenshots)
4. 🔄 Submit for approval
5. 🔄 Launch!

**Questions?** The marketplace team responds within 24 hours during business days.
