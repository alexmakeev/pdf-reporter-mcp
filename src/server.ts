// =============================================================================
// server.ts -- PDF Reporter MCP Server Entry Point
// =============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type {
  GeneratePdfOutput,
  GetTemplateSchemaOutput,
  ListTemplatesOutput,
  RenderDiagramOutput,
} from './types.js';
import { PdfReporterError } from './types.js';

// Import granular pipeline functions
import { renderDiagram, renderContent, generatePdfFromHtml } from './pipeline.js';

// -----------------------------------------------------------------------------
// Zod Schemas for MCP Tool Input Validation
// -----------------------------------------------------------------------------

const RenderDiagramInputSchema = z.object({
  name: z.string().describe('Diagram identifier, used as {{diagram:name}} in content'),
  mermaid: z.string().describe('Mermaid diagram source code'),
});

const RenderContentInputSchema = z.object({
  markdown: z
    .string()
    .describe(
      'Markdown content with optional :::callout syntax and {{diagram:name}} placeholders',
    ),
  diagrams: z
    .array(
      z.object({
        name: z.string().describe('Diagram name matching {{diagram:name}} placeholder'),
        svg: z.string().describe('SVG string from render_diagram tool'),
      }),
    )
    .optional()
    .describe('Pre-rendered diagrams from render_diagram tool'),
});

const PageMarginsSchema = z.object({
  top: z.string().optional(),
  bottom: z.string().optional(),
  left: z.string().optional(),
  right: z.string().optional(),
});

const PdfOptionsSchema = z
  .object({
    pageSize: z.string().default('A4'),
    toc: z.boolean().default(false),
    headerTemplate: z.union([z.string(), z.literal(false)]).optional(),
    footerTemplate: z.union([z.string(), z.literal(false)]).optional(),
    margins: PageMarginsSchema.optional(),
  })
  .optional();

const GeneratePdfFromHtmlInputSchema = z.object({
  title: z.string().describe('Document title for cover page'),
  subtitle: z.string().optional().describe('Document subtitle'),
  logo: z.string().optional().describe('Logo as data URI or file path'),
  content: z.string().describe('HTML content (from render_content tool) or raw Markdown'),
  template: z.string().default('generic').describe('Template name'),
  options: PdfOptionsSchema,
});

const GetTemplateSchemaInputSchema = z.object({
  template: z.string().describe('Template name'),
});

// -----------------------------------------------------------------------------
// Error Response Helper
// -----------------------------------------------------------------------------

function buildErrorResponse(error: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  if (error instanceof PdfReporterError) {
    return {
      content: [{ type: 'text', text: `Error [${error.code}]: ${error.message}` }],
      isError: true,
    };
  }

  if (error instanceof z.ZodError) {
    const formattedErrors = error.issues
      .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');

    return {
      content: [{ type: 'text', text: `Validation error: ${formattedErrors}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Internal error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}

// -----------------------------------------------------------------------------
// MCP Server Setup
// -----------------------------------------------------------------------------

const server = new McpServer({
  name: 'pdf-reporter',
  version: '1.0.0',
});

// -----------------------------------------------------------------------------
// Tool: render_diagram
// -----------------------------------------------------------------------------

server.tool(
  'render_diagram',
  'Render a Mermaid diagram to SVG. The document uses a pastel color theme. When composing Mermaid diagrams, use LIGHT/PASTEL background fills with BLACK text — never use dark fills with white text. The theme primary color is Royal Blue (#4169E1). Choose pastel shades of blue, green, amber, violet etc. for node fills. Example Mermaid styles: style A fill:#E0E7F5,color:#1a1a1a,stroke:#4169E1',
  RenderDiagramInputSchema.shape,
  async (input) => {
    try {
      const result: RenderDiagramOutput = await renderDiagram(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ name: result.name, svg: result.svg }),
          },
        ],
      };
    } catch (error) {
      return buildErrorResponse(error);
    }
  },
);

// -----------------------------------------------------------------------------
// Tool: render_content
// -----------------------------------------------------------------------------

server.tool(
  'render_content',
  'Render Markdown content with callouts and diagram placeholders to HTML. Pass pre-rendered diagrams from render_diagram (which should use palette colors for visual harmony).',
  RenderContentInputSchema.shape,
  async (input) => {
    try {
      const result = await renderContent(input);
      return {
        content: [{ type: 'text', text: result.html }],
      };
    } catch (error) {
      return buildErrorResponse(error);
    }
  },
);

// -----------------------------------------------------------------------------
// Tool: generate_pdf
// -----------------------------------------------------------------------------

server.tool(
  'generate_pdf',
  'Generate a PDF document from pre-rendered HTML content',
  GeneratePdfFromHtmlInputSchema.shape,
  async (input) => {
    try {
      const result: GeneratePdfOutput = await generatePdfFromHtml(input);
      return {
        content: [
          {
            type: 'text',
            text: `PDF generated: ${result.path} (${result.size})${result.pages ? `, ${result.pages} pages` : ''}`,
          },
        ],
      };
    } catch (error) {
      return buildErrorResponse(error);
    }
  },
);

// -----------------------------------------------------------------------------
// Tool: list_templates
// -----------------------------------------------------------------------------

server.tool('list_templates', 'List available PDF report templates', {}, async () => {
  const result: ListTemplatesOutput = {
    templates: [
      {
        name: 'generic',
        description:
          'Universal report template with cover page, optional TOC, and markdown content',
      },
    ],
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

// -----------------------------------------------------------------------------
// Tool: get_template_schema
// -----------------------------------------------------------------------------

server.tool(
  'get_template_schema',
  'Get the schema (required and optional fields) for a specific template',
  GetTemplateSchemaInputSchema.shape,
  async (input) => {
    try {
      if (input.template === 'generic') {
        const result: GetTemplateSchemaOutput = {
          required: ['title', 'content'],
          optional: ['subtitle', 'logo', 'template', 'options'],
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      throw new PdfReporterError(
        'TEMPLATE_NOT_FOUND',
        `Template not found: ${input.template}`,
      );
    } catch (error) {
      return buildErrorResponse(error);
    }
  },
);

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PDF Reporter MCP server started on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
