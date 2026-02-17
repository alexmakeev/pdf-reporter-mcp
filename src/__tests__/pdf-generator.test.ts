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

      expect(mockPage.setContent).toHaveBeenCalledWith(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

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

      expect(mockBrowser.close).toHaveBeenCalled();
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
    });
  });
});
