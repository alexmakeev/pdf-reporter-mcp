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
      // Two-pass compilation: report template produces body, base template wraps it
      // The content from the report template should be inside the base body section
      expect(result).toContain('<p>Test content</p>');
      expect(result).toContain('Test Report');
    });

    it('should use cache and call readFile only once for the same template', async () => {
      // Clear cache by using a unique template name
      const templateName = 'generic-cache-test';

      // First call — loads files and populates cache
      await compileTemplate(baseContext, templateName);
      const readFileCallCountAfterFirst = vi.mocked(readFile).mock.calls.length;

      // Second call — should use cache, readFile should not be called again for this template
      await compileTemplate(baseContext, templateName);
      const readFileCallCountAfterSecond = vi.mocked(readFile).mock.calls.length;

      // No additional readFile calls for the template on the second invocation
      expect(readFileCallCountAfterSecond).toBe(readFileCallCountAfterFirst);
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

      // Should format the date as "Month Day, Year" (en-US locale)
      expect(result).toContain('February');
      expect(result).toContain('16');
      expect(result).toContain('2026');
      // Verify the date string is a properly formatted en-US date (not just the raw ISO string)
      expect(result).not.toContain('2026-02-16');
    });

    it('should use eq helper for conditionals', async () => {
      const customTemplate = `
{{#if (eq options.pageSize "A4")}}
<p>This is A4</p>
{{else}}
<p>Not A4</p>
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

      // Test with equal value (A4 === A4 → true branch)
      const resultA4 = await compileTemplate(baseContext, 'custom');
      expect(resultA4).toContain('This is A4');
      expect(resultA4).not.toContain('Not A4');

      // Test with unequal value (Letter !== A4 → false branch)
      const letterContext = {
        ...baseContext,
        options: { ...baseContext.options, pageSize: 'Letter' as const },
      };
      // Use a different template name to bypass cache
      vi.mocked(readFile).mockImplementation((async (path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('base.hbs')) {
          return mockBaseTemplate;
        }
        if (pathStr.includes('custom-letter.hbs')) {
          return customTemplate;
        }
        if (pathStr.includes('report.css')) {
          return mockCss;
        }
        throw new Error(`File not found: ${pathStr}`);
      }) as typeof readFile);
      const resultLetter = await compileTemplate(letterContext, 'custom-letter');
      expect(resultLetter).toContain('Not A4');
      expect(resultLetter).not.toContain('This is A4');
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
      // Verify partials are loaded from the partials directory
      expect(readdir).toHaveBeenCalledWith(expect.stringContaining('partials'));
      // Verify the partial file was read
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('testPartial.hbs'),
        'utf-8',
      );
    });

    it('should skip non-.hbs files in partials directory', async () => {
      // When readdir returns non-.hbs files, they should be skipped (not registered as partials)
      vi.mocked(readdir).mockResolvedValue([
        'header.hbs',
        'readme.txt',
        'styles.css',
        '.DS_Store',
      ] as unknown as Awaited<ReturnType<typeof readdir>>);

      vi.mocked(readFile).mockImplementation((async (path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('base.hbs')) return mockBaseTemplate;
        if (pathStr.includes('generic-test-skip.hbs')) return mockReportTemplate;
        if (pathStr.includes('report.css')) return mockCss;
        if (pathStr.includes('header.hbs')) return '<header>{{meta.title}}</header>';
        // Non-.hbs files should never be read as partials
        if (pathStr.endsWith('.txt') || pathStr.endsWith('.DS_Store')) {
          throw new Error(`Should not read non-.hbs file: ${pathStr}`);
        }
        throw new Error(`File not found: ${pathStr}`);
      }) as typeof readFile);

      // Should succeed without reading non-.hbs files as partials
      const result = await compileTemplate(baseContext, 'generic-test-skip');
      expect(result).toBeDefined();

      // Only header.hbs should have been read from the partials directory
      // (not readme.txt, styles.css, .DS_Store)
      const readFileCalls = vi.mocked(readFile).mock.calls.map(call => String(call[0]));
      const partialFilesRead = readFileCalls.filter(p => {
        // Exclude base template, report template, and CSS
        return !p.includes('base.hbs') && !p.includes('generic-test-skip') && !p.includes('report.css');
      });
      // Only the .hbs partial file should have been read
      expect(partialFilesRead).toHaveLength(1);
      expect(partialFilesRead[0]).toContain('header.hbs');
    });

    it('should read report template from reports subdirectory', async () => {
      await compileTemplate(baseContext, 'generic-test-6');

      // The readFile calls should include a path with 'reports' directory component
      const readFileCalls = vi.mocked(readFile).mock.calls.map(call => String(call[0]));
      const templateCall = readFileCalls.find(p => p.includes('generic-test-6'));
      expect(templateCall).toBeDefined();
      expect(templateCall).toContain('reports');
    });

    it('should read CSS from styles directory', async () => {
      await compileTemplate(baseContext, 'generic-test-7');

      const readFileCalls = vi.mocked(readFile).mock.calls.map(call => String(call[0]));
      const cssCall = readFileCalls.find(p => p.includes('report.css'));
      expect(cssCall).toBeDefined();
      expect(cssCall).toContain('styles');
    });

    it('should read base template from templates directory', async () => {
      await compileTemplate(baseContext, 'generic-test-8');

      const readFileCalls = vi.mocked(readFile).mock.calls.map(call => String(call[0]));
      const baseCall = readFileCalls.find(p => p.includes('base.hbs'));
      expect(baseCall).toBeDefined();
      expect(baseCall).toContain('templates');
    });

    it('should call formatDate with undefined date value to return current date', async () => {
      // The formatDate helper has a branch: if (!dateStr) return current date
      // To exercise it, pass a context value that's undefined
      const templateWithUndefinedDate = `
<div class="cover">
<h1>{{meta.title}}</h1>
<p>{{formatDate meta.date}}</p>
</div>
{{{content}}}
`;

      vi.mocked(readFile).mockImplementation((async (path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('base.hbs')) return mockBaseTemplate;
        if (pathStr.includes('no-date-undef.hbs')) return templateWithUndefinedDate;
        if (pathStr.includes('report.css')) return mockCss;
        throw new Error(`File not found: ${pathStr}`);
      }) as typeof readFile);

      // Context where meta.date is undefined (not set)
      const contextUndefinedDate: PipelineContext = {
        ...baseContext,
        meta: { title: 'No Date Report' },
      };

      const result = await compileTemplate(contextUndefinedDate, 'no-date-undef');
      // formatDate with undefined should return today's date in en-US long format
      expect(result).toMatch(/[A-Z][a-z]+ \d+, \d{4}/);
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
