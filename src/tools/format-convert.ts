import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerFormatTools(server: McpServer) {
  server.tool(
    "format_convert",
    "Convert between file formats locally. No external APIs. " +
    "Supports MD↔HTML, CSV↔JSON, YAML↔JSON, XML→JSON, plaintext→structured MD.",
    {
      input_format: z.enum(["md", "html", "csv", "json", "yaml", "xml", "plaintext"])
        .describe("Source format"),
      output_format: z.enum(["md", "html", "csv", "json", "yaml", "xml"])
        .describe("Target format"),
      content: z.string().describe("Content to convert"),
    },
    async ({ input_format, output_format, content }) => {
      try {
        let result: string;

        // Convert to intermediate format (JSON or text)
        let intermediate: any;

        switch (input_format) {
          case "json":
            intermediate = JSON.parse(content);
            break;
          case "csv":
            intermediate = parseCSV(content);
            break;
          case "yaml":
            intermediate = parseYAML(content);
            break;
          case "xml":
            intermediate = parseXML(content);
            break;
          case "md":
          case "html":
          case "plaintext":
            intermediate = content; // Keep as text
            break;
        }

        // Convert from intermediate to target format
        switch (output_format) {
          case "json":
            result = typeof intermediate === "string" ? 
              JSON.stringify({ text: intermediate }, null, 2) : 
              JSON.stringify(intermediate, null, 2);
            break;
          case "csv":
            result = toCSV(intermediate);
            break;
          case "yaml":
            result = toYAML(intermediate);
            break;
          case "xml":
            result = toXML(intermediate);
            break;
          case "html":
            result = toHTML(intermediate);
            break;
          case "md":
            result = toMarkdown(intermediate);
            break;
        }

        return {
          content: [{ 
            type: "text", 
            text: `Converted from ${input_format} to ${output_format}:\n\n${result}` 
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}

// Simple CSV parser
function parseCSV(content: string): any[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
  
  return data;
}

// Simple CSV generator
function toCSV(data: any): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvLines = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header]?.toString() || '';
      return value.includes(',') ? `"${value}"` : value;
    });
    csvLines.push(values.join(','));
  });
  
  return csvLines.join('\n');
}

// Simple YAML parser (basic implementation)
function parseYAML(content: string): any {
  const lines = content.trim().split('\n');
  const result: any = {};
  
  lines.forEach(line => {
    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (match) {
      const [, indent, key, value] = match;
      const cleanKey = key.trim();
      const cleanValue = value.trim();
      
      if (indent.length === 0) {
        result[cleanKey] = cleanValue || '';
      }
    }
  });
  
  return result;
}

// Simple YAML generator
function toYAML(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  
  const lines: string[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`);
      Object.entries(value as any).forEach(([subKey, subValue]) => {
        lines.push(`  ${subKey}: ${subValue}`);
      });
    } else {
      lines.push(`${key}: ${value}`);
    }
  });
  
  return lines.join('\n');
}

// Simple XML parser (basic implementation)
function parseXML(content: string): any {
  const result: any = {};
  
  // Extract root element
  const rootMatch = content.match(/<([^>]+)>([\s\S]*)<\/\1>/);
  if (rootMatch) {
    const [, rootTag, rootContent] = rootMatch;
    result[rootTag] = parseXMLContent(rootContent);
  }
  
  return result;
}

function parseXMLContent(content: string): any {
  const result: any = {};
  
  // Find all tags
  const tagMatches = content.matchAll(/<([^>]+)>([\s\S]*?)<\/\1>/g);
  
  for (const match of tagMatches) {
    const [, tag, tagContent] = match;
    
    // Check if nested tags
    if (tagContent.includes('<')) {
      result[tag] = parseXMLContent(tagContent);
    } else {
      result[tag] = tagContent.trim();
    }
  }
  
  return result;
}

// Simple XML generator
function toXML(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  
  const lines: string[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      lines.push(`<${key}>`);
      lines.push(toXML(value));
      lines.push(`</${key}>`);
    } else {
      lines.push(`<${key}>${value}</${key}>`);
    }
  });
  
  return lines.join('\n');
}

// Simple HTML generator
function toHTML(data: any): string {
  if (typeof data === 'string') {
    return `<div>${data}</div>`;
  }
  
  if (Array.isArray(data)) {
    return `<ul>\n${data.map(item => `<li>${toHTML(item)}</li>`).join('\n')}\n</ul>`;
  }
  
  const lines: string[] = ['<div>'];
  
  Object.entries(data).forEach(([key, value]) => {
    lines.push(`  <div><strong>${key}:</strong> ${toHTML(value)}</div>`);
  });
  
  lines.push('</div>');
  return lines.join('\n');
}

// Simple Markdown generator
function toMarkdown(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => `- ${toMarkdown(item)}`).join('\n');
  }
  
  const lines: string[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      lines.push(`## ${key}`);
      lines.push(toMarkdown(value));
    } else {
      lines.push(`**${key}**: ${value}`);
    }
  });
  
  return lines.join('\n\n');
}
