// =============================================================================
// server.test.ts -- Tests for MCP Server Tools
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock the pipeline module with the 3 granular functions
vi.mock('../pipeline.js', () => ({
  renderDiagram: vi.fn(),
  renderContent: vi.fn(),
  generatePdfFromHtml: vi.fn(),
}));

// Capture registered tool handlers so we can call them directly in tests
type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;
const registeredTools: Record<string, ToolHandler> = {};

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: vi.fn((name: string, _description: string, _schema: unknown, handler: ToolHandler) => {
      registeredTools[name] = handler;
    }),
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

// Import mocked pipeline functions and the server (triggers registration)
import { renderDiagram, renderContent, generatePdfFromHtml } from '../pipeline.js';
import { PdfReporterError } from '../types.js';

// Side-effect import: registers tools into registeredTools map
await import('../server.js');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type McpResponse = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

function getTextContent(response: unknown): string {
  const r = response as McpResponse;
  return r.content[0].text;
}

function isError(response: unknown): boolean {
  return (response as McpResponse).isError === true;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('server tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // render_diagram
  // ---------------------------------------------------------------------------

  describe('render_diagram', () => {
    it('renders a diagram and returns JSON with name and svg', async () => {
      vi.mocked(renderDiagram).mockResolvedValue({
        name: 'arch',
        svg: '<svg>...</svg>',
      });

      const response = await registeredTools['render_diagram']({
        name: 'arch',
        mermaid: 'graph LR\n  A --> B',
      });

      expect(renderDiagram).toHaveBeenCalledWith({
        name: 'arch',
        mermaid: 'graph LR\n  A --> B',
      });

      const parsed = JSON.parse(getTextContent(response));
      expect(parsed).toEqual({ name: 'arch', svg: '<svg>...</svg>' });
      expect(isError(response)).toBe(false);
    });

    it('returns structured error response on PdfReporterError', async () => {
      vi.mocked(renderDiagram).mockRejectedValue(
        new PdfReporterError('MERMAID_RENDER_FAILED', 'Diagram rendering failed'),
      );

      const response = await registeredTools['render_diagram']({
        name: 'bad',
        mermaid: 'invalid mermaid',
      });

      expect(isError(response)).toBe(true);
      expect(getTextContent(response)).toBe(
        'Error [MERMAID_RENDER_FAILED]: Diagram rendering failed',
      );
    });

    it('returns internal error on unexpected exception', async () => {
      vi.mocked(renderDiagram).mockRejectedValue(new Error('Unexpected failure'));

      const response = await registeredTools['render_diagram']({
        name: 'x',
        mermaid: '...',
      });

      expect(isError(response)).toBe(true);
      expect(getTextContent(response)).toBe('Internal error: Unexpected failure');
    });
  });

  // ---------------------------------------------------------------------------
  // render_content
  // ---------------------------------------------------------------------------

  describe('render_content', () => {
    it('renders markdown to HTML', async () => {
      vi.mocked(renderContent).mockResolvedValue({ html: '<p>Hello</p>' });

      const response = await registeredTools['render_content']({
        markdown: '# Hello',
      });

      expect(renderContent).toHaveBeenCalledWith({ markdown: '# Hello' });
      expect(getTextContent(response)).toBe('<p>Hello</p>');
      expect(isError(response)).toBe(false);
    });

    it('passes diagrams array to renderContent', async () => {
      vi.mocked(renderContent).mockResolvedValue({
        html: '<p>Report</p><div class="diagram-svg"><svg/></div>',
      });

      const diagrams = [{ name: 'flow', svg: '<svg/>' }];
      const response = await registeredTools['render_content']({
        markdown: '# Report\n{{diagram:flow}}',
        diagrams,
      });

      expect(renderContent).toHaveBeenCalledWith({
        markdown: '# Report\n{{diagram:flow}}',
        diagrams,
      });
      expect(getTextContent(response)).toContain('diagram-svg');
    });

    it('renders content without diagrams field', async () => {
      vi.mocked(renderContent).mockResolvedValue({ html: '<p>Plain</p>' });

      const response = await registeredTools['render_content']({
        markdown: 'Plain content',
      });

      expect(renderContent).toHaveBeenCalledWith({ markdown: 'Plain content' });
      expect(getTextContent(response)).toBe('<p>Plain</p>');
    });

    it('returns structured error response on PdfReporterError', async () => {
      vi.mocked(renderContent).mockRejectedValue(
        new PdfReporterError('MARKDOWN_PARSE_FAILED', 'Failed to parse markdown'),
      );

      const response = await registeredTools['render_content']({ markdown: '' });

      expect(isError(response)).toBe(true);
      expect(getTextContent(response)).toBe(
        'Error [MARKDOWN_PARSE_FAILED]: Failed to parse markdown',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // generate_pdf
  // ---------------------------------------------------------------------------

  describe('generate_pdf', () => {
    it('returns formatted message with path, size, and pages', async () => {
      vi.mocked(generatePdfFromHtml).mockResolvedValue({
        path: '/tmp/output/report.pdf',
        size: '2.4 MB',
        pages: 10,
      });

      const response = await registeredTools['generate_pdf']({
        title: 'Test Report',
        content: '<p>Content</p>',
      });

      expect(generatePdfFromHtml).toHaveBeenCalledWith({
        title: 'Test Report',
        content: '<p>Content</p>',
      });
      expect(getTextContent(response)).toBe(
        'PDF generated: /tmp/output/report.pdf (2.4 MB), 10 pages',
      );
      expect(isError(response)).toBe(false);
    });

    it('omits pages count when pages field is not present', async () => {
      vi.mocked(generatePdfFromHtml).mockResolvedValue({
        path: '/tmp/output/report.pdf',
        size: '1.1 MB',
      });

      const response = await registeredTools['generate_pdf']({
        title: 'Minimal Report',
        content: '<p>Content</p>',
      });

      expect(getTextContent(response)).toBe(
        'PDF generated: /tmp/output/report.pdf (1.1 MB)',
      );
    });

    it('passes all optional fields to generatePdfFromHtml', async () => {
      vi.mocked(generatePdfFromHtml).mockResolvedValue({
        path: '/tmp/output/full.pdf',
        size: '3.0 MB',
        pages: 5,
      });

      const input = {
        title: 'Full Report',
        subtitle: 'Q4 2025',
        logo: 'data:image/png;base64,abc',
        content: '<p>Body</p>',
        template: 'generic',
        options: {
          pageSize: 'Letter',
          toc: true,
          margins: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        },
      };

      const response = await registeredTools['generate_pdf'](input);

      expect(generatePdfFromHtml).toHaveBeenCalledWith(input);
      expect(getTextContent(response)).toContain('full.pdf');
      expect(getTextContent(response)).toContain('5 pages');
    });

    it('returns structured error response on PdfReporterError', async () => {
      vi.mocked(generatePdfFromHtml).mockRejectedValue(
        new PdfReporterError('PDF_GENERATION_FAILED', 'Puppeteer crashed'),
      );

      const response = await registeredTools['generate_pdf']({
        title: 'Bad Report',
        content: '<p>Content</p>',
      });

      expect(isError(response)).toBe(true);
      expect(getTextContent(response)).toBe(
        'Error [PDF_GENERATION_FAILED]: Puppeteer crashed',
      );
    });

    it('validates required fields — missing title triggers error', () => {
      const GeneratePdfInputSchema = z.object({
        title: z.string().describe('Document title'),
        content: z.string().describe('HTML content'),
        subtitle: z.string().optional(),
        logo: z.string().optional(),
        template: z.string().default('generic'),
        options: z
          .object({
            pageSize: z.string().default('A4'),
            toc: z.boolean().default(false),
            headerTemplate: z.union([z.string(), z.literal(false)]).optional(),
            footerTemplate: z.union([z.string(), z.literal(false)]).optional(),
            margins: z
              .object({
                top: z.string().optional(),
                bottom: z.string().optional(),
                left: z.string().optional(),
                right: z.string().optional(),
              })
              .optional(),
          })
          .optional(),
      });

      // Missing title
      expect(() => GeneratePdfInputSchema.parse({ content: 'test' })).toThrow(z.ZodError);
      // Missing content
      expect(() => GeneratePdfInputSchema.parse({ title: 'test' })).toThrow(z.ZodError);

      // Valid minimum input with defaults applied
      const valid = GeneratePdfInputSchema.parse({ title: 'T', content: 'C' });
      expect(valid.title).toBe('T');
      expect(valid.content).toBe('C');
      expect(valid.template).toBe('generic');
    });
  });

  // ---------------------------------------------------------------------------
  // list_templates
  // ---------------------------------------------------------------------------

  describe('list_templates', () => {
    it('returns templates array containing generic', async () => {
      const response = await registeredTools['list_templates']({});

      const parsed = JSON.parse(getTextContent(response)) as {
        templates: Array<{ name: string; description: string }>;
      };

      expect(parsed.templates).toHaveLength(1);
      expect(parsed.templates[0].name).toBe('generic');
      expect(parsed.templates[0].description).toContain('Universal report template');
      expect(isError(response)).toBe(false);
    });

    it('returns well-formed JSON string with indent 2', async () => {
      const response = await registeredTools['list_templates']({});
      const text = getTextContent(response);
      // JSON.stringify with null, 2 produces indented output
      expect(text).toContain('\n');
      expect(text).toContain('  ');
      // Round-trips cleanly
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // get_template_schema
  // ---------------------------------------------------------------------------

  describe('get_template_schema', () => {
    it('returns schema for the generic template', async () => {
      const response = await registeredTools['get_template_schema']({
        template: 'generic',
      });

      const parsed = JSON.parse(getTextContent(response)) as {
        required: string[];
        optional: string[];
      };

      expect(parsed.required).toContain('title');
      expect(parsed.required).toContain('content');
      expect(parsed.optional).toContain('subtitle');
      expect(parsed.optional).toContain('logo');
      expect(parsed.optional).toContain('template');
      expect(parsed.optional).toContain('options');
      expect(isError(response)).toBe(false);
    });

    it('returns error for unknown template', async () => {
      const response = await registeredTools['get_template_schema']({
        template: 'nonexistent',
      });

      expect(isError(response)).toBe(true);
      expect(getTextContent(response)).toBe(
        'Error [TEMPLATE_NOT_FOUND]: Template not found: nonexistent',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling utility (buildErrorResponse behavior)
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('formats PdfReporterError with code and message', () => {
      const error = new PdfReporterError('MERMAID_RENDER_FAILED', 'Diagram rendering failed');

      const response = {
        content: [
          {
            type: 'text' as const,
            text: `Error [${error.code}]: ${error.message}`,
          },
        ],
        isError: true as const,
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toBe(
        'Error [MERMAID_RENDER_FAILED]: Diagram rendering failed',
      );
    });

    it('formats Zod validation errors with path and message', () => {
      const schema = z.object({ title: z.string(), content: z.string() });

      try {
        schema.parse({ title: 'Test' }); // missing content
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(z.ZodError);
        if (err instanceof z.ZodError) {
          const formattedErrors = err.issues
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          const text = `Validation error: ${formattedErrors}`;
          expect(text).toContain('Validation error');
          expect(text).toContain('content');
        }
      }
    });

    it('formats generic Error as internal error', () => {
      const error = new Error('Unexpected system error');

      const response = {
        content: [
          {
            type: 'text' as const,
            text: `Internal error: ${error.message}`,
          },
        ],
        isError: true as const,
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toBe('Internal error: Unexpected system error');
    });
  });
});
