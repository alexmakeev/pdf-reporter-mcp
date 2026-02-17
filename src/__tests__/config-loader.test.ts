// =============================================================================
// config-loader.test.ts -- Tests for PDF Options Resolution
// =============================================================================

import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../config-loader.js';
import { DEFAULT_MARGINS, DEFAULT_PAGE_SIZE, type GeneratePdfInput } from '../types.js';

describe('config-loader', () => {
  describe('resolveOptions', () => {
    it('should apply default values when no options provided', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
      };

      const result = resolveOptions(input);

      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(result.toc).toBe(false);
      expect(result.headerTemplate).toBe(false);
      expect(result.footerTemplate).toBe(false);
      expect(result.margins).toEqual(DEFAULT_MARGINS);
    });

    it('should use custom pageSize', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          pageSize: 'Letter',
        },
      };

      const result = resolveOptions(input);

      expect(result.pageSize).toBe('Letter');
    });

    it('should merge partial margins with defaults', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          margins: {
            top: '20mm',
            left: '15mm',
          },
        },
      };

      const result = resolveOptions(input);

      expect(result.margins).toEqual({
        top: '20mm',
        bottom: DEFAULT_MARGINS.bottom,
        left: '15mm',
        right: DEFAULT_MARGINS.right,
      });
    });

    it('should use custom margins when all provided', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          margins: {
            top: '10mm',
            bottom: '10mm',
            left: '10mm',
            right: '10mm',
          },
        },
      };

      const result = resolveOptions(input);

      expect(result.margins).toEqual({
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      });
    });

    it('should enable TOC when specified', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          toc: true,
        },
      };

      const result = resolveOptions(input);

      expect(result.toc).toBe(true);
    });

    it('should use custom header template', () => {
      const customHeader = '<div>Custom Header</div>';
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          headerTemplate: customHeader,
        },
      };

      const result = resolveOptions(input);

      expect(result.headerTemplate).toBe(customHeader);
    });

    it('should use custom footer template', () => {
      const customFooter = '<div>Custom Footer</div>';
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          footerTemplate: customFooter,
        },
      };

      const result = resolveOptions(input);

      expect(result.footerTemplate).toBe(customFooter);
    });

    it('should disable header when headerTemplate is false', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          headerTemplate: false,
        },
      };

      const result = resolveOptions(input);

      expect(result.headerTemplate).toBe(false);
    });

    it('should handle all options combined', () => {
      const input: GeneratePdfInput = {
        title: 'Test',
        content: 'Content',
        options: {
          pageSize: 'Legal',
          toc: true,
          headerTemplate: '<div>Header</div>',
          footerTemplate: '<div>Footer</div>',
          margins: {
            top: '25mm',
            bottom: '25mm',
            left: '20mm',
            right: '20mm',
          },
        },
      };

      const result = resolveOptions(input);

      expect(result.pageSize).toBe('Legal');
      expect(result.toc).toBe(true);
      expect(result.headerTemplate).toBe('<div>Header</div>');
      expect(result.footerTemplate).toBe('<div>Footer</div>');
      expect(result.margins).toEqual({
        top: '25mm',
        bottom: '25mm',
        left: '20mm',
        right: '20mm',
      });
    });
  });
});
