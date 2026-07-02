// =============================================================================
// pipeline.test.ts -- Tests for PDF Generation Pipeline
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePdfPipeline, generatePdfFromHtml, renderContent, namespaceSvgIds } from '../pipeline.js';
import { PdfReporterError, type GeneratePdfInput } from '../types.js';

// Mock all downstream modules
vi.mock('../markdown-renderer.js', () => ({
  renderMarkdown: vi.fn(),
}));

vi.mock('../template-engine.js', () => ({
  compileTemplate: vi.fn(),
}));

vi.mock('../pdf-generator.js', () => ({
  generatePdf: vi.fn(),
}));

import { renderMarkdown } from '../markdown-renderer.js';
import { compileTemplate } from '../template-engine.js';
import { generatePdf } from '../pdf-generator.js';

describe('pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(renderMarkdown).mockResolvedValue('<p>Rendered markdown</p>');
    vi.mocked(compileTemplate).mockResolvedValue('<html><body>Complete HTML</body></html>');
    vi.mocked(generatePdf).mockResolvedValue({
      path: '/tmp/output/test-report.pdf',
      size: '1.2 MB',
      pages: 5,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // generatePdfFromHtml / generatePdfPipeline
  // ---------------------------------------------------------------------------

  describe('generatePdfFromHtml', () => {
    it('should compile template with pre-rendered HTML content', async () => {
      const input: GeneratePdfInput = {
        title: 'Test Report',
        content: '<p>Pre-rendered HTML</p>',
      };

      const result = await generatePdfFromHtml(input);

      // Should NOT call renderMarkdown — content is already HTML
      expect(renderMarkdown).not.toHaveBeenCalled();

      expect(compileTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '<p>Pre-rendered HTML</p>',
          meta: expect.objectContaining({ title: 'Test Report' }),
          theme: expect.objectContaining({
            primaryColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
            coverColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
          }),
        }),
        'generic',
      );
      expect(generatePdf).toHaveBeenCalled();
      expect(result.path).toBe('/tmp/output/test-report.pdf');
      expect(result.size).toBe('1.2 MB');
      expect(result.pages).toBe(5);
    });

    it('should use custom template when specified', async () => {
      const input: GeneratePdfInput = {
        title: 'Custom Template Test',
        content: '<p>Content</p>',
        template: 'business-report',
      };

      await generatePdfFromHtml(input);

      expect(compileTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '<p>Content</p>',
          meta: expect.objectContaining({ title: 'Custom Template Test' }),
        }),
        'business-report',
      );
    });

    it('should apply TOC option', async () => {
      const input: GeneratePdfInput = {
        title: 'Report with TOC',
        content: '<p>Content</p>',
        options: { toc: true },
      };

      await generatePdfFromHtml(input);

      expect(compileTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ toc: true }),
        }),
        'generic',
      );
    });

    it('should pass custom page size to PDF generator', async () => {
      const input: GeneratePdfInput = {
        title: 'Letter Size Report',
        content: '<p>Content</p>',
        options: { pageSize: 'Letter' },
      };

      await generatePdfFromHtml(input);

      expect(generatePdf).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          options: expect.objectContaining({ pageSize: 'Letter' }),
        }),
      );
    });

    it('should include subtitle and logo in metadata', async () => {
      const input: GeneratePdfInput = {
        title: 'Full Report',
        subtitle: 'Q1 2026',
        logo: 'data:image/png;base64,xxx',
        content: '<p>Content</p>',
      };

      await generatePdfFromHtml(input);

      expect(compileTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            title: 'Full Report',
            subtitle: 'Q1 2026',
            logo: 'data:image/png;base64,xxx',
          }),
        }),
        'generic',
      );
    });

    it('should sanitize filename from title', async () => {
      const input: GeneratePdfInput = {
        title: 'My Report! #2024 (Final)',
        content: '<p>Content</p>',
      };

      await generatePdfFromHtml(input);

      const call = vi.mocked(generatePdf).mock.calls[0];
      expect(call).toBeDefined();
      const pdfOptions = call![1];
      expect(pdfOptions.filename).toBe('my-report-2024-final');
      expect(pdfOptions.filename).not.toContain('!');
      expect(pdfOptions.filename).not.toContain('#');
      expect(pdfOptions.filename).not.toContain('(');
      expect(pdfOptions.filename).not.toContain(')');
    });

    it('should strip multiple trailing dashes from filename', async () => {
      // The /-+$/ regex should strip all trailing dashes, not just one
      const input: GeneratePdfInput = {
        title: 'Report ---',
        content: '<p>Content</p>',
      };

      await generatePdfFromHtml(input);

      const call = vi.mocked(generatePdf).mock.calls[0];
      expect(call).toBeDefined();
      const pdfOptions = call![1];
      // Title "Report ---" → lowercased: "report ---" → replace non-alnum: "report---" → strip trailing dashes: "report"
      expect(pdfOptions.filename).toBe('report');
      expect(pdfOptions.filename).not.toMatch(/-$/);
    });

    it('should include long-format month in meta date', async () => {
      const input: GeneratePdfInput = {
        title: 'Date Test',
        content: '<p>Content</p>',
      };

      await generatePdfFromHtml(input);

      const call = vi.mocked(compileTemplate).mock.calls[0];
      expect(call).toBeDefined();
      const context = call![0];
      // The date should be in long format (e.g. "February 17, 2026"), not ISO format
      expect(context.meta.date).toMatch(/[A-Z][a-z]+ \d+, \d{4}/);
    });

    it('should use OUTPUT_DIR env var for output directory', async () => {
      const originalEnv = process.env['OUTPUT_DIR'];
      process.env['OUTPUT_DIR'] = '/custom/output/path';

      try {
        const input: GeneratePdfInput = {
          title: 'Test',
          content: '<p>Content</p>',
        };

        await generatePdfFromHtml(input);

        const call = vi.mocked(generatePdf).mock.calls[0];
        expect(call).toBeDefined();
        expect(call![1].outputDir).toBe('/custom/output/path');
      } finally {
        if (originalEnv === undefined) {
          delete process.env['OUTPUT_DIR'];
        } else {
          process.env['OUTPUT_DIR'] = originalEnv;
        }
      }
    });

    it('should default to output subdirectory when OUTPUT_DIR is not set', async () => {
      const originalEnv = process.env['OUTPUT_DIR'];
      delete process.env['OUTPUT_DIR'];

      try {
        const input: GeneratePdfInput = {
          title: 'Test',
          content: '<p>Content</p>',
        };

        await generatePdfFromHtml(input);

        const call = vi.mocked(generatePdf).mock.calls[0];
        expect(call).toBeDefined();
        expect(call![1].outputDir).toContain('output');
      } finally {
        if (originalEnv !== undefined) {
          process.env['OUTPUT_DIR'] = originalEnv;
        }
      }
    });

    it('should use THEME_PRIMARY_COLOR env var for theme', async () => {
      const originalEnv = process.env['THEME_PRIMARY_COLOR'];
      process.env['THEME_PRIMARY_COLOR'] = '#FF0000';

      try {
        const input: GeneratePdfInput = {
          title: 'Theme Test',
          content: '<p>Content</p>',
        };

        await generatePdfFromHtml(input);

        const call = vi.mocked(compileTemplate).mock.calls[0];
        expect(call).toBeDefined();
        const context = call![0];
        expect(context.theme.primaryColor).toBe('#FF0000');
      } finally {
        if (originalEnv === undefined) {
          delete process.env['THEME_PRIMARY_COLOR'];
        } else {
          process.env['THEME_PRIMARY_COLOR'] = originalEnv;
        }
      }
    });

    it('should use THEME_COVER_COLOR env var separately from primary color', async () => {
      const originalPrimary = process.env['THEME_PRIMARY_COLOR'];
      const originalCover = process.env['THEME_COVER_COLOR'];
      process.env['THEME_PRIMARY_COLOR'] = '#FF0000';
      process.env['THEME_COVER_COLOR'] = '#00FF00';

      try {
        const input: GeneratePdfInput = {
          title: 'Cover Color Test',
          content: '<p>Content</p>',
        };

        await generatePdfFromHtml(input);

        const call = vi.mocked(compileTemplate).mock.calls[0];
        expect(call).toBeDefined();
        const context = call![0];
        expect(context.theme.primaryColor).toBe('#FF0000');
        expect(context.theme.coverColor).toBe('#00FF00');
      } finally {
        if (originalPrimary === undefined) {
          delete process.env['THEME_PRIMARY_COLOR'];
        } else {
          process.env['THEME_PRIMARY_COLOR'] = originalPrimary;
        }
        if (originalCover === undefined) {
          delete process.env['THEME_COVER_COLOR'];
        } else {
          process.env['THEME_COVER_COLOR'] = originalCover;
        }
      }
    });

    it('should propagate PdfReporterError from template engine', async () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: '<p>Content</p>',
        template: 'unknown',
      };

      const error = new PdfReporterError('TEMPLATE_NOT_FOUND', 'Template missing');
      vi.mocked(compileTemplate).mockRejectedValue(error);

      await expect(generatePdfFromHtml(input)).rejects.toThrow(PdfReporterError);
      await expect(generatePdfFromHtml(input)).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
    });

    it('should propagate PdfReporterError from PDF generator', async () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: '<p>Content</p>',
      };

      const error = new PdfReporterError('PDF_GENERATION_FAILED', 'Puppeteer failed');
      vi.mocked(generatePdf).mockRejectedValue(error);

      await expect(generatePdfFromHtml(input)).rejects.toThrow(PdfReporterError);
      await expect(generatePdfFromHtml(input)).rejects.toMatchObject({ code: 'PDF_GENERATION_FAILED' });
    });
  });

  // ---------------------------------------------------------------------------
  // generatePdfPipeline (backward compat wrapper)
  // ---------------------------------------------------------------------------

  describe('generatePdfPipeline', () => {
    it('should delegate to generatePdfFromHtml and return result', async () => {
      const input: GeneratePdfInput = {
        title: 'Test Report',
        content: '<p>Pre-rendered HTML</p>',
      };

      const result = await generatePdfPipeline(input);

      expect(compileTemplate).toHaveBeenCalled();
      expect(generatePdf).toHaveBeenCalled();
      expect(result.path).toBe('/tmp/output/test-report.pdf');
      expect(result.size).toBe('1.2 MB');
      expect(result.pages).toBe(5);
    });

    it('should wrap unknown errors in INTERNAL_ERROR', async () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: '<p>Content</p>',
      };

      const error = new Error('Unexpected failure');
      vi.mocked(compileTemplate).mockRejectedValue(error);

      await expect(generatePdfPipeline(input)).rejects.toThrow(PdfReporterError);
      await expect(generatePdfPipeline(input)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Pipeline failed'),
      });
    });

    it('should pass through PdfReporterError without re-wrapping', async () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: '<p>Content</p>',
        template: 'unknown',
      };

      const error = new PdfReporterError('TEMPLATE_NOT_FOUND', 'Template missing');
      vi.mocked(compileTemplate).mockRejectedValue(error);

      await expect(generatePdfPipeline(input)).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
    });
  });

  // ---------------------------------------------------------------------------
  // renderContent
  // ---------------------------------------------------------------------------

  describe('renderContent', () => {
    it('should render markdown and return HTML', async () => {
      vi.mocked(renderMarkdown).mockResolvedValue('<p>Hello</p>');

      const result = await renderContent({ markdown: '# Hello' });

      expect(renderMarkdown).toHaveBeenCalledWith('# Hello');
      expect(result).toEqual({ html: '<p>Hello</p>' });
    });

    it('should replace diagram placeholders with SVG wrappers', async () => {
      vi.mocked(renderMarkdown).mockResolvedValue('<p>Before {{diagram:flow}} After</p>');

      const result = await renderContent({
        markdown: 'Before {{diagram:flow}} After',
        diagrams: [{ name: 'flow', svg: '<svg>diagram</svg>' }],
      });

      expect(result.html).toContain('<div class="diagram-container">');
      expect(result.html).toContain('<div class="diagram-svg">');
      expect(result.html).toContain('<svg>diagram</svg>');
      expect(result.html).not.toContain('{{diagram:flow}}');
      // Verify the exact SVG is embedded (not some other SVG)
      expect(result.html).toContain('<svg>diagram</svg>');
      // Verify renderMarkdown was called with the original markdown text
      expect(renderMarkdown).toHaveBeenCalledWith('Before {{diagram:flow}} After');
    });

    it('should use diagram name in placeholder pattern {{diagram:name}}', async () => {
      // The placeholder must use the diagram name — if placeholder was empty string, no replacement would occur
      vi.mocked(renderMarkdown).mockResolvedValue('{{diagram:arch}} {{diagram:flow}}');

      const result = await renderContent({
        markdown: 'content',
        diagrams: [
          { name: 'arch', svg: '<svg>arch-svg</svg>' },
          { name: 'flow', svg: '<svg>flow-svg</svg>' },
        ],
      });

      // Both placeholders must be replaced using correct names
      expect(result.html).not.toContain('{{diagram:arch}}');
      expect(result.html).not.toContain('{{diagram:flow}}');
      expect(result.html).toContain('<svg>arch-svg</svg>');
      expect(result.html).toContain('<svg>flow-svg</svg>');
    });

    it('should replace all occurrences of the same diagram placeholder', async () => {
      // replaceAll not replace — need to verify all occurrences are replaced
      vi.mocked(renderMarkdown).mockResolvedValue('{{diagram:flow}} and again {{diagram:flow}}');

      const result = await renderContent({
        markdown: 'content',
        diagrams: [{ name: 'flow', svg: '<svg>diagram</svg>' }],
      });

      expect(result.html).not.toContain('{{diagram:flow}}');
      // Both occurrences should have been replaced
      const matches = result.html.match(/<svg>diagram<\/svg>/g);
      expect(matches).toHaveLength(2);
    });

    it('should handle missing diagrams array gracefully', async () => {
      vi.mocked(renderMarkdown).mockResolvedValue('<p>Content</p>');

      const result = await renderContent({ markdown: 'Content' });

      expect(result).toEqual({ html: '<p>Content</p>' });
    });

    it('should namespace colliding SVG ids across multiple diagrams', async () => {
      vi.mocked(renderMarkdown).mockResolvedValue('<p>{{diagram:a}}{{diagram:b}}</p>');

      const svg = '<svg id="my-svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg>';
      const result = await renderContent({
        markdown: 'x',
        diagrams: [
          { name: 'a', svg },
          { name: 'b', svg },
        ],
      });

      // Each diagram gets a unique namespace — no bare `id="my-svg"` collision remains
      expect(result.html).not.toContain('id="my-svg"');
      expect(result.html).not.toContain('id="g"');
      expect(result.html).toContain('id="dg0-a-my-svg"');
      expect(result.html).toContain('id="dg1-b-my-svg"');
      // References are rewritten to match their own namespace
      expect(result.html).toContain('url(#dg0-a-g)');
      expect(result.html).toContain('url(#dg1-b-g)');
    });
  });

  describe('namespaceSvgIds', () => {
    it('should rewrite ids and url(#..)/href references with the prefix', () => {
      const svg = '<svg id="s"><clipPath id="c"/><rect clip-path="url(#c)"/><use href="#s"/></svg>';
      const out = namespaceSvgIds(svg, 'ns');
      expect(out).toContain('id="ns-s"');
      expect(out).toContain('id="ns-c"');
      expect(out).toContain('url(#ns-c)');
      expect(out).toContain('href="#ns-s"');
    });

    it('should return the SVG untouched when there are no ids', () => {
      const svg = '<svg><rect width="10" height="10"/></svg>';
      expect(namespaceSvgIds(svg, 'ns')).toBe(svg);
    });

    it('should rewrite #id references inside an embedded <style> block (Mermaid scoping)', () => {
      // Mermaid scopes its whole stylesheet to the root svg id; if the id is
      // namespaced but the selector is not, all styling breaks (black nodes).
      const svg =
        '<svg id="root"><style>#root .node rect{fill:#E0E7F5}#root .edge{stroke:#333}</style><rect/></svg>';
      const out = namespaceSvgIds(svg, 'ns');
      expect(out).toContain('id="ns-root"');
      expect(out).toContain('#ns-root .node rect{fill:#E0E7F5}');
      expect(out).toContain('#ns-root .edge{stroke:#333}');
      // A hex color that is not an id must be left alone
      expect(out).toContain('fill:#E0E7F5');
    });

    it('should not partially rewrite an id that is a prefix of another id', () => {
      const svg = '<svg id="a"><g id="ab"><rect fill="url(#ab)"/><rect fill="url(#a)"/></g></svg>';
      const out = namespaceSvgIds(svg, 'ns');
      expect(out).toContain('id="ns-a"');
      expect(out).toContain('id="ns-ab"');
      expect(out).toContain('url(#ns-ab)');
      expect(out).toContain('url(#ns-a)');
    });
  });
});
