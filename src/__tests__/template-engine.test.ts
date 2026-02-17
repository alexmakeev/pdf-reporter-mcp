// =============================================================================
// template-engine.test.ts -- Tests for Handlebars Template Compilation
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PdfReporterError, type PipelineContext } from '../types.js';

// Mock fs/promises BEFORE importing template-engine
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, readdir } from 'node:fs/promises';
import { compileTemplate } from '../template-engine.js';

describe('template-engine', () => {
  const baseContext: PipelineContext = {
    content: '<p>Test content</p>',
    diagrams: {},
    meta: {
      title: 'Test Report',
      subtitle: 'Test Subtitle',
      date: '2026-02-16',
    },
    options: {
      pageSize: 'A4',
      toc: false,
      headerTemplate: false,
      footerTemplate: false,
      margins: {
        top: '17mm',
        bottom: '17mm',
        left: '13mm',
        right: '13mm',
      },
    },
  };

  const mockBaseTemplate = `
<!DOCTYPE html>
<html>
<head>
<style>{{{styles}}}</style>
</head>
<body>
{{{body}}}
</body>
</html>
`;

  const mockReportTemplate = `
<div class="cover">
<h1>{{meta.title}}</h1>
{{#if meta.subtitle}}
<h2>{{meta.subtitle}}</h2>
{{/if}}
<p>{{formatDate meta.date}}</p>
</div>
<div class="content">
{{{content}}}
</div>
`;

  const mockCss = 'body { font-family: Arial; }';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readFile).mockImplementation((async (path: unknown) => {
      const pathStr = String(path);
      if (pathStr.includes('base.hbs')) {
        return mockBaseTemplate;
      }
      // Match any generic template variant (generic.hbs, generic-test-1.hbs, etc.)
      if (pathStr.includes('generic') && pathStr.endsWith('.hbs')) {
        return mockReportTemplate;
      }
      if (pathStr.includes('report.css')) {
        return mockCss;
      }
      throw new Error(`File not found: ${pathStr}`);
    }) as typeof readFile);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('compileTemplate', () => {
    it('should wrap content in base template', async () => {
      const result = await compileTemplate(baseContext, 'generic');

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<body>');
      expect(result).toContain('</html>');
    });

    it('should render report template with context', async () => {
      const result = await compileTemplate(baseContext, 'generic-test-1');

      expect(result).toContain('Test Report');
      expect(result).toContain('Test Subtitle');
      expect(result).toContain('<p>Test content</p>');
    });

    it('should embed CSS styles', async () => {
      const result = await compileTemplate(baseContext, 'generic-test-2');

      expect(result).toContain('<style>');
      expect(result).toContain('body { font-family: Arial; }');
      expect(result).toContain('</style>');
    });

    it('should throw TEMPLATE_NOT_FOUND for unknown template', async () => {
      vi.mocked(readFile).mockImplementation((async (path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('base.hbs')) {
          return mockBaseTemplate;
        }
        if (pathStr.includes('report.css')) {
          return mockCss;
        }
        if (pathStr.includes('unknown.hbs')) {
          throw new Error('ENOENT: no such file');
        }
        throw new Error(`File not found: ${pathStr}`);
      }) as typeof readFile);

      await expect(compileTemplate(baseContext, 'unknown')).rejects.toThrow(PdfReporterError);
      await expect(compileTemplate(baseContext, 'unknown')).rejects.toMatchObject({
        code: 'TEMPLATE_NOT_FOUND',
        message: expect.stringContaining('Report template not found'),
      });
    });

    it('should use formatDate helper', async () => {
      const result = await compileTemplate(baseContext, 'generic-test-3');

      // Should format the date
      expect(result).toContain('February');
      expect(result).toContain('16');
      expect(result).toContain('2026');
    });

    it('should use eq helper for conditionals', async () => {
      const customTemplate = `
{{#if (eq options.pageSize "A4")}}
<p>This is A4</p>
{{/if}}
{{{content}}}
`;

      vi.mocked(readFile).mockImplementation((async (path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('base.hbs')) {
          return mockBaseTemplate;
        }
        if (pathStr.includes('custom.hbs')) {
          return customTemplate;
        }
        if (pathStr.includes('report.css')) {
          return mockCss;
        }
        throw new Error(`File not found: ${pathStr}`);
      }) as typeof readFile);

      const result = await compileTemplate(baseContext, 'custom');

      expect(result).toContain('This is A4');
    });

    it('should load and register partials', async () => {
      const partialTemplate = '<div class="partial-content">{{text}}</div>';
      const reportWithPartial = `
<h1>{{meta.title}}</h1>
{{> testPartial text="Hello from partial"}}
`;

      vi.mocked(readdir).mockResolvedValue(['testPartial.hbs'] as unknown as Awaited<ReturnType<typeof readdir>>);
      vi.mocked(readFile).mockImplementation((async (path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('base.hbs')) {
          return mockBaseTemplate;
        }
        if (pathStr.includes('generic-test-4.hbs')) {
          return reportWithPartial;
        }
        if (pathStr.includes('testPartial.hbs')) {
          return partialTemplate;
        }
        if (pathStr.includes('report.css')) {
          return mockCss;
        }
        throw new Error(`File not found: ${pathStr}`);
      }) as typeof readFile);

      const result = await compileTemplate(baseContext, 'generic-test-4');

      expect(result).toContain('Hello from partial');
      expect(result).toContain('partial-content');
    });

    it('should handle missing subtitle gracefully', async () => {
      const contextWithoutSubtitle: PipelineContext = {
        ...baseContext,
        meta: {
          title: 'Test Report',
          date: '2026-02-16',
        },
      };

      const result = await compileTemplate(contextWithoutSubtitle, 'generic-test-5');

      expect(result).toContain('Test Report');
      expect(result).not.toContain('Test Subtitle');
    });

    it('should render diagrams when provided', async () => {
      const contextWithDiagram: PipelineContext = {
        ...baseContext,
        diagrams: {
          flow: {
            type: 'rendered-diagram',
            svg: '<svg>test diagram</svg>',
          },
        },
      };

      const result = await compileTemplate(contextWithDiagram, 'generic');

      expect(result).toBeDefined();
      // Context includes diagrams, template can access them
    });
  });
});
