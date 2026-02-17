// =============================================================================
// pipeline.test.ts -- Tests for PDF Generation Pipeline
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePdfPipeline, generatePdfFromHtml, renderDiagram, renderContent } from '../pipeline.js';
import { PdfReporterError, type GeneratePdfInput } from '../types.js';

// Mock all downstream modules
vi.mock('../mermaid-renderer.js', () => ({
  renderDiagrams: vi.fn(),
}));

vi.mock('../markdown-renderer.js', () => ({
  renderMarkdown: vi.fn(),
}));

vi.mock('../template-engine.js', () => ({
  compileTemplate: vi.fn(),
}));

vi.mock('../pdf-generator.js', () => ({
  generatePdf: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
}));

import { renderDiagrams } from '../mermaid-renderer.js';
import { renderMarkdown } from '../markdown-renderer.js';
import { compileTemplate } from '../template-engine.js';
import { generatePdf } from '../pdf-generator.js';
import { mkdtemp, rm } from 'node:fs/promises';

describe('pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(mkdtemp).mockResolvedValue('/tmp/pdf-reporter-abc123');
    vi.mocked(rm).mockResolvedValue(undefined);
    vi.mocked(renderDiagrams).mockResolvedValue({});
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
      // Should NOT call renderDiagrams — diagrams handled upstream
      expect(renderDiagrams).not.toHaveBeenCalled();

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
  // renderDiagram
  // ---------------------------------------------------------------------------

  describe('renderDiagram', () => {
    it('should create temp dir, render diagram, return SVG, and clean up', async () => {
      vi.mocked(renderDiagrams).mockResolvedValue({
        flow: { type: 'rendered-diagram', svg: '<svg>diagram</svg>' },
      });

      const result = await renderDiagram({ name: 'flow', mermaid: 'graph TD\nA-->B' });

      expect(mkdtemp).toHaveBeenCalled();
      expect(renderDiagrams).toHaveBeenCalledWith(
        [{ name: 'flow', mermaid: 'graph TD\nA-->B' }],
        '/tmp/pdf-reporter-abc123',
      );
      expect(rm).toHaveBeenCalledWith('/tmp/pdf-reporter-abc123', { recursive: true, force: true });
      expect(result).toEqual({ name: 'flow', svg: '<svg>diagram</svg>' });
    });

    it('should throw MERMAID_RENDER_FAILED if diagram not in results', async () => {
      vi.mocked(renderDiagrams).mockResolvedValue({});

      await expect(renderDiagram({ name: 'missing', mermaid: 'graph TD\nA-->B' })).rejects.toMatchObject({
        code: 'MERMAID_RENDER_FAILED',
      });
    });

    it('should clean up temp dir even when renderDiagrams throws', async () => {
      vi.mocked(renderDiagrams).mockRejectedValue(new PdfReporterError('MERMAID_RENDER_FAILED', 'fail'));

      await expect(renderDiagram({ name: 'flow', mermaid: 'invalid' })).rejects.toThrow();

      expect(rm).toHaveBeenCalledWith('/tmp/pdf-reporter-abc123', { recursive: true, force: true });
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

    it('should handle missing diagrams array gracefully', async () => {
      vi.mocked(renderMarkdown).mockResolvedValue('<p>Content</p>');

      const result = await renderContent({ markdown: 'Content' });

      expect(result).toEqual({ html: '<p>Content</p>' });
    });
  });
});
