import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";
import { AgentErrorFactory, ValidationUtils, withErrorHandling, ErrorCode } from "../errors.js";
import { builtInTemplates } from "./template-library.js";
import type { LicenseInfo } from "../license.js";

// Simple template engine - supports {{variable}}, {%if condition%}, {%for item in items%}
function renderTemplate(template: string, variables: Record<string, unknown>): string {
  let result = template;
  
  // Handle for loops: {%for item in items%}...{{item}}...{%endfor%}
  const forRegex = /{%for\s+(\w+)\s+in\s+(\w+)%}([\s\S]*?){%endfor%}/g;
  result = result.replace(forRegex, (_match, itemName, arrayName, content) => {
    const array = variables[arrayName] as unknown[] | undefined;
    if (!Array.isArray(array)) {
      return '';
    }
    return array.map(item => {
      const itemVars = { ...variables, [itemName]: item };
      return renderSimpleVars(content, itemVars);
    }).join('');
  });
  
  // Handle conditionals: {%if condition%}...{%endif%}
  const ifRegex = /{%if\s+(\w+)%}([\s\S]*?){%endif%}/g;
  result = result.replace(ifRegex, (_match, condition, content) => {
    const value = variables[condition];
    return value ? content : '';
  });
  
  // Handle simple variables: {{variable}}
  result = renderSimpleVars(result, variables);
  
  return result;
}

function renderSimpleVars(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName];
    return value !== undefined ? String(value) : match;
  });
}
, license: LicenseInfo
export function registerTemplateEngineTools(server: McpServer) {
  // Initialize built-in templates on first use
  let initialized = false;
  
  async function initBuiltInTemplates() {
    if (initialized) return;
    
    for (const template of builtInTemplates) {
      const existing = db.prepare("SELECT id FROM templates WHERE name = ? AND is_builtin = 1").get(template.name);
      if (!existing) {
        db.prepare(`
          INSERT INTO templates (id, name, category, description, template_content, variables, is_builtin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch())
        `).run(
          `builtin_${template.name}`,
          template.name,
          template.category,
          template.description,
          template.content,
          JSON.stringify(template.variables)
        );
      }
    }
    initialized = true;
  }

  server.tool(
    "template_list",
    "List all available templates with optional category filter.",
    {
      category: z.string().optional().describe("Filter by category (builtin, user, etc.)"),
      is_builtin: z.boolean().optional().describe("Filter by built-in status"),
    },
    withErrorHandling(async ({ category, is_builtin }) => {
      await initBuiltInTemplates();
      
      try {
        let query = "SELECT id, name, category, description, is_builtin FROM templates WHERE 1=1";
        const params: (string | number)[] = [];

        if (category) {
          query += " AND category = ?";
          params.push(category);
        }
        
        if (is_builtin !== undefined) {
          query += " AND is_builtin = ?";
          params.push(is_builtin ? 1 : 0);
        }

        query += " ORDER BY is_builtin DESC, name";

        const templates = db.prepare(query).all(...params) as Array<{
          id: string;
          name: string;
          category: string;
          description: string;
          is_builtin: number;
        }>;

        if (templates.length === 0) {
          return {
            content: [{ type: "text", text: "No templates found" }],
          };
        }

        const list = templates.map(t => 
          `- ${t.name} [${t.category}] ${t.is_builtin ? '(builtin)' : ''}\n  ${t.description}`
        ).join('\n');

        return {
          content: [{ type: "text", text: `Templates (${templates.length}):\n${list}` }],
        };
      } catch (error) {
        throw AgentErrorFactory.databaseError('template_list', error as Error);
      }
    })
  );

  server.tool(
    "template_render",
    "Render a template with provided variables.",
    {
      template_name: z.string().describe("Template name or ID"),
      variables: z.string().describe("JSON-encoded variables object"),
      custom_template: z.string().optional().describe("Override with custom template content"),
    },
    withErrorHandling(async ({ template_name, variables, custom_template }) => {
      await initBuiltInTemplates();
      
      const validatedName = ValidationUtils.validateString(template_name, 1, 255);
      
      try {
        // Parse variables JSON
        let parsedVars: Record<string, unknown>;
        try {
          parsedVars = JSON.parse(variables);
        } catch {
          throw AgentErrorFactory.create(ErrorCode.INVALID_CONTENT, "Invalid JSON in variables parameter");
        }

        // Get template content
        let templateContent: string;
        
        if (custom_template) {
          templateContent = custom_template;
        } else {
          const template = db.prepare("SELECT * FROM templates WHERE name = ? OR id = ?").get(validatedName, validatedName) as {
            template_content: string;
            variables: string;
          } | undefined;

          if (!template) {
            throw AgentErrorFactory.create(ErrorCode.TEMPLATE_NOT_FOUND, `Template "${validatedName}" not found`);
          }

          templateContent = template.template_content;
        }

        // Render template
        const startTime = Date.now();
        const rendered = renderTemplate(templateContent, parsedVars);
        const duration = Date.now() - startTime;

        return {
          content: [{ 
            type: "text", 
            text: rendered 
          }],
          metadata: {
            render_time_ms: duration,
            template: validatedName
          }
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('template_render', error as Error);
      }
    })
  );

  server.tool(
    "template_create",
    "Create a new custom template.",
    {
      name: z.string().describe("Template name (unique identifier)"),
      category: z.string().describe("Template category"),
      description: z.string().describe("Template description"),
      content: z.string().describe("Template content with {{variable}} syntax"),
      variables: z.string().describe("JSON array of required variable names"),
    },
    withErrorHandling(async ({ name, category, description, content, variables }) => {
      const validatedName = ValidationUtils.validateString(name, 1, 100);
      const validatedCategory = ValidationUtils.validateString(category, 1, 50);
      const validatedDesc = ValidationUtils.validateString(description, 0, 500);
      
      try {
        // Parse variables
        let varArray: string[];
        try {
          varArray = JSON.parse(variables);
          if (!Array.isArray(varArray)) {
            throw new Error("Variables must be an array");
          }
        } catch {
          throw AgentErrorFactory.create(ErrorCode.INVALID_CONTENT, "Invalid JSON array in variables parameter");
        }

        // Check for duplicate name
        const existing = db.prepare("SELECT id FROM templates WHERE name = ? AND is_builtin = 0").get(validatedName);
        if (existing) {
          throw AgentErrorFactory.create(ErrorCode.INVALID_TEMPLATE, `Template "${validatedName}" already exists`);
        }

        const templateId = `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        db.prepare(`
          INSERT INTO templates (id, name, category, description, template_content, variables, is_builtin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, unixepoch())
        `).run(
          templateId,
          validatedName,
          validatedCategory,
          validatedDesc,
          content,
          JSON.stringify(varArray)
        );

        return {
          content: [{ 
            type: "text", 
            text: `Template "${validatedName}" created (${templateId})\nCategory: ${validatedCategory}\nVariables: ${varArray.join(', ')}` 
          }],
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        throw AgentErrorFactory.databaseError('template_create', error as Error);
      }
    })
  );
}
