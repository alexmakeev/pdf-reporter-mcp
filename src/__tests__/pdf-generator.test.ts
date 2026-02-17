// =============================================================================
// pdf-generator.test.ts -- Tests for PDF Generation with Puppeteer
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePdf } from '../pdf-generator.js';
import { PdfReporterError, type PdfGeneratorOptions } from '../types.js';

// Mock puppeteer
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';

describe('pdf-generator', () => {
  let mockBrowser: ReturnType<typeof vi.fn>;
  let mockPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock page
    mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from('mock pdf content')),
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock browser
    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Mock puppeteer.launch
    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as unknown as ReturnType<typeof puppeteer.launch>);

    // Mock mkdir
    vi.mocked(mkdir).mockResolvedValue(undefined);

    // Mock writeFile
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePdf', () => {
    it('should generate PDF with correct options', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test-report',
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

      const result = await generatePdf(html, options);

      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      expect(mockPage.setContent).toHaveBeenCalledWith(
        '<html><body>Test</body></html>',
        {
          waitUntil: 'networkidle0',
          timeout: 30000,
        },
      );

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'A4',
          margin: {
            top: '17mm',
            bottom: '17mm',
            left: '13mm',
            right: '13mm',
          },
          displayHeaderFooter: true,
          printBackground: true,
        }),
      );

      // PDF is generated once into buffer, then written to file
      expect(mockPage.pdf).toHaveBeenCalledTimes(1);
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-report'),
        expect.any(Buffer),
      );

      expect(result.path).toContain('test-report');
      expect(result.path).toContain('.pdf');
      expect(result.size).toBe('16 B'); // Buffer.from('mock pdf content').length = 16
      expect(result.pages).toBeGreaterThanOrEqual(1);
    });

    it('should use custom page size and margins', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'custom',
        options: {
          pageSize: 'Letter',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: {
            top: '25mm',
            bottom: '25mm',
            left: '20mm',
            right: '20mm',
          },
        },
      };

      await generatePdf(html, options);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'Letter',
          margin: {
            top: '25mm',
            bottom: '25mm',
            left: '20mm',
            right: '20mm',
          },
        }),
      );
    });

    it('should disable header when headerTemplate is false', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'no-header',
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

      await generatePdf(html, options);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          headerTemplate: '<span></span>',
          footerTemplate: '<span></span>',
        }),
      );
    });

    it('should use custom header and footer templates', async () => {
      const html = '<html><body>Test</body></html>';
      const customHeader = '<div>Custom Header</div>';
      const customFooter = '<div>Custom Footer</div>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'custom-templates',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: customHeader,
          footerTemplate: customFooter,
          margins: {
            top: '17mm',
            bottom: '17mm',
            left: '13mm',
            right: '13mm',
          },
        },
      };

      await generatePdf(html, options);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          headerTemplate: customHeader,
          footerTemplate: customFooter,
        }),
      );
    });

    it('should close browser on success', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
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

      await generatePdf(html, options);

      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it('should close browser on error and throw PdfReporterError', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
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

      const error = new Error('Puppeteer failed');
      mockPage.setContent.mockRejectedValue(error);

      await expect(generatePdf(html, options)).rejects.toThrow(PdfReporterError);
      await expect(generatePdf(html, options)).rejects.toMatchObject({
        code: 'PDF_GENERATION_FAILED',
        message: expect.stringContaining('Failed to generate PDF'),
      });

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should format file size correctly', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
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

      // Test small file size (500 bytes)
      mockPage.pdf.mockResolvedValueOnce(Buffer.alloc(500));
      let result = await generatePdf(html, options);
      expect(result.size).toBe('500 B');

      // Test KB file size (5120 bytes = 5.0 KB)
      mockPage.pdf.mockResolvedValueOnce(Buffer.alloc(5120));
      result = await generatePdf(html, options);
      expect(result.size).toBe('5.0 KB');

      // Test MB file size (2 * 1024 * 1024 = 2097152 bytes = 2.0 MB)
      mockPage.pdf.mockResolvedValueOnce(Buffer.alloc(2 * 1024 * 1024));
      result = await generatePdf(html, options);
      expect(result.size).toBe('2.0 MB');
    });

    it('should format exactly 1023 bytes as B (below 1024 threshold)', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      mockPage.pdf.mockResolvedValueOnce(Buffer.alloc(1023));
      const result = await generatePdf(html, options);
      // 1023 < 1024 → should be "1023 B", not KB
      expect(result.size).toBe('1023 B');
    });

    it('should format exactly 1024 bytes as KB (at 1024 threshold)', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      mockPage.pdf.mockResolvedValueOnce(Buffer.alloc(1024));
      const result = await generatePdf(html, options);
      // 1024 is NOT < 1024, so it should be "1.0 KB"
      expect(result.size).toBe('1.0 KB');
    });

    it('should format exactly 1024*1024 bytes as MB (at 1MB threshold)', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      mockPage.pdf.mockResolvedValueOnce(Buffer.alloc(1024 * 1024));
      const result = await generatePdf(html, options);
      // 1024*1024 is NOT < 1024*1024, so it should be "1.0 MB"
      expect(result.size).toBe('1.0 MB');
    });

    it('should create output directory with recursive flag', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/deep/nested/output',
        filename: 'test',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      await generatePdf(html, options);

      expect(mkdir).toHaveBeenCalledWith('/tmp/deep/nested/output', { recursive: true });
    });

    it('should include YYYY-MM-DD date (sliced to 10 chars) in output filename', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'dated-report',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      await generatePdf(html, options);

      const writeFileCall = vi.mocked(writeFile).mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const outputPath = String(writeFileCall![0]);
      // The date in filename must be exactly YYYY-MM-DD (10 chars), not the full ISO string
      expect(outputPath).toMatch(/dated-report-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('should use default header template with filename when headerTemplate is not false', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'my-report',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: undefined as unknown as string,
          footerTemplate: undefined as unknown as string,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      await generatePdf(html, options);

      const pdfCall = mockPage.pdf.mock.calls[0];
      expect(pdfCall).toBeDefined();
      const pdfOptions = pdfCall![0];
      // Default header should contain the filename with dashes replaced by spaces
      expect(pdfOptions.headerTemplate).toContain('my report');
      // Default footer should contain pageNumber span
      expect(pdfOptions.footerTemplate).toContain('pageNumber');
      expect(pdfOptions.footerTemplate).toContain('totalPages');
    });

    it('should count PDF pages from binary content matching /Type /Page pattern', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      // Create a buffer that simulates a 3-page PDF binary with /Type /Page entries
      // The pattern /\/Type[\s]*\/Page[^s]/g matches "/Type /Page " or "/Type/Page "
      // but NOT "/Type /Pages" (which is the parent node)
      const fakePdfContent =
        'header /Type /Page X body1 /Type /Page Y body2 /Type /Pages Z /Type /Page W footer';
      const pdfBuffer = Buffer.from(fakePdfContent, 'latin1');
      mockPage.pdf.mockResolvedValueOnce(pdfBuffer);

      const result = await generatePdf(html, options);

      // 3 occurrences of "/Type /Page " (not "/Type /Pages")
      expect(result.pages).toBe(3);
    });

    it('should count PDF pages matching /Type/Page without whitespace', async () => {
      const html = '<html><body>Test</body></html>';
      const options: PdfGeneratorOptions = {
        outputDir: '/tmp/output',
        filename: 'test',
        options: {
          pageSize: 'A4',
          toc: false,
          headerTemplate: false,
          footerTemplate: false,
          margins: { top: '17mm', bottom: '17mm', left: '13mm', right: '13mm' },
        },
      };

      // [\s]* (zero or more) also matches /Type/Page with NO whitespace
      // while [\s] (exactly one) would NOT match this case
      const fakePdfContent = 'start /Type/Page X /Type/Page Y /Type/Pages Z end';
      const pdfBuffer = Buffer.from(fakePdfContent, 'latin1');
      mockPage.pdf.mockResolvedValueOnce(pdfBuffer);

      const result = await generatePdf(html, options);

      // 2 occurrences of /Type/Page (no whitespace), not /Type/Pages
      expect(result.pages).toBe(2);
    });
  });
});
