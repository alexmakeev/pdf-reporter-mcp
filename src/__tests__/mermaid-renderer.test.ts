// =============================================================================
// mermaid-renderer.test.ts -- Tests for Mermaid Diagram Rendering
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderDiagrams } from '../mermaid-renderer.js';
import { PdfReporterError } from '../types.js';

// Mock node modules
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

// Import mocked modules
import { execFile } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

describe('mermaid-renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderDiagrams', () => {
    it('should successfully render a single diagram', async () => {
      const diagrams = [
        {
          name: 'flowchart',
          mermaid: 'graph TD\nA-->B',
        },
      ];

      const mockSvg = '<svg>test diagram</svg>';

      // Mock execFile (via promisify)
      vi.mocked(execFile).mockImplementation(((_file, _args, _opts, callback) => {
        if (callback) {
          callback(null, { stdout: '', stderr: '' });
        }
      }) as typeof execFile);

      // Mock readFile to return SVG
      vi.mocked(readFile).mockResolvedValue(mockSvg);

      // Mock writeFile
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const result = await renderDiagrams(diagrams, '/tmp/test');

      expect(result).toHaveProperty('flowchart');
      expect(result.flowchart).toEqual({
        type: 'rendered-diagram',
        svg: mockSvg,
      });

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.mmd'),
        'graph TD\nA-->B',
        'utf-8',
      );

      expect(execFile).toHaveBeenCalledWith(
        expect.stringContaining('mmdc'),
        expect.arrayContaining(['-i', '-o', '-t', 'neutral']),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function),
      );

      // Verify readFile is called to read the .svg output file
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('.svg'),
        'utf-8',
      );
    });

    it('should successfully render multiple diagrams', async () => {
      const diagrams = [
        { name: 'diagram1', mermaid: 'graph TD\nA-->B' },
        { name: 'diagram2', mermaid: 'sequenceDiagram\nAlice->>Bob: Hello' },
      ];

      const mockSvg1 = '<svg>diagram 1</svg>';
      const mockSvg2 = '<svg>diagram 2</svg>';

      vi.mocked(execFile).mockImplementation(((_file, _args, _opts, callback) => {
        if (callback) {
          callback(null, { stdout: '', stderr: '' });
        }
      }) as typeof execFile);

      vi.mocked(readFile)
        .mockResolvedValueOnce(mockSvg1)
        .mockResolvedValueOnce(mockSvg2);

      vi.mocked(writeFile).mockResolvedValue(undefined);

      const result = await renderDiagrams(diagrams, '/tmp/test');

      expect(Object.keys(result)).toHaveLength(2);
      // Assert EACH diagram key exists with correct SVG content
      expect(result).toHaveProperty('diagram1');
      expect(result).toHaveProperty('diagram2');
      expect(result.diagram1).toEqual({ type: 'rendered-diagram', svg: mockSvg1 });
      expect(result.diagram2).toEqual({ type: 'rendered-diagram', svg: mockSvg2 });
      expect(result.diagram1.svg).toBe('<svg>diagram 1</svg>');
      expect(result.diagram2.svg).toBe('<svg>diagram 2</svg>');
      // Each diagram should have been written to a .mmd file
      expect(writeFile).toHaveBeenCalledTimes(2);
      // Each diagram should have been rendered via mmdc
      expect(execFile).toHaveBeenCalledTimes(2);
    });

    it('should return empty record for empty diagrams array', async () => {
      const result = await renderDiagrams([], '/tmp/test');

      expect(result).toEqual({});
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should throw PdfReporterError with MERMAID_RENDER_FAILED on mmdc failure', async () => {
      const diagrams = [
        { name: 'broken', mermaid: 'invalid mermaid syntax' },
      ];

      const error = new Error('mmdc failed');

      vi.mocked(execFile).mockImplementation(((_file, _args, _opts, callback) => {
        if (callback) {
          callback(error, { stdout: '', stderr: 'Syntax error' });
        }
      }) as typeof execFile);

      vi.mocked(writeFile).mockResolvedValue(undefined);

      await expect(renderDiagrams(diagrams, '/tmp/test')).rejects.toThrow(PdfReporterError);
      await expect(renderDiagrams(diagrams, '/tmp/test')).rejects.toMatchObject({
        code: 'MERMAID_RENDER_FAILED',
        message: expect.stringContaining('Failed to render diagram "broken"'),
      });
    });

    it('should handle writeFile errors gracefully', async () => {
      const diagrams = [
        { name: 'test', mermaid: 'graph TD\nA-->B' },
      ];

      const writeError = new Error('EACCES: permission denied');
      vi.mocked(writeFile).mockRejectedValue(writeError);

      // writeFile is now inside try-catch, so error is wrapped in PdfReporterError
      await expect(renderDiagrams(diagrams, '/tmp/test')).rejects.toThrow(PdfReporterError);
      await expect(renderDiagrams(diagrams, '/tmp/test')).rejects.toMatchObject({
        code: 'MERMAID_RENDER_FAILED',
        message: expect.stringContaining('EACCES: permission denied'),
      });
    });
  });
});
