// =============================================================================
// mermaid-renderer.ts -- Render Mermaid Diagrams to SVG
// =============================================================================

import { execFile } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  PdfReporterError,
  type DiagramInput,
  type RenderedDiagram,
} from './types.js';

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Render a single Mermaid diagram to SVG.
 * @param raw - Mermaid diagram source code
 * @param name - Diagram name (for error messages)
 * @param tempDir - Temporary directory for intermediate files
 * @returns Rendered diagram with SVG content
 */
async function renderSingleDiagram(
  raw: string,
  name: string,
  tempDir: string,
): Promise<RenderedDiagram> {
  const hash = createHash('md5').update(raw).digest('hex').slice(0, 8);
  const inputPath = join(tempDir, `${hash}.mmd`);
  const outputPath = join(tempDir, `${hash}.svg`);

  try {
    await writeFile(inputPath, raw, 'utf-8');

    const mmdc = join(__dirname, '..', 'node_modules', '.bin', 'mmdc');
    await execFileAsync(
      mmdc,
      [
        '-i',
        inputPath,
        '-o',
        outputPath,
        '-t',
        'neutral',
        '--backgroundColor',
        'transparent',
      ],
      { timeout: 30000 },
    );

    const svg = await readFile(outputPath, 'utf-8');
    return { type: 'rendered-diagram', svg };
  } catch (err) {
    throw new PdfReporterError(
      'MERMAID_RENDER_FAILED',
      `Failed to render diagram "${name}": ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined,
    );
  }
}

/**
 * Render all Mermaid diagrams to SVG.
 * @param diagrams - Array of diagram inputs
 * @param tempDir - Temporary directory for intermediate files
 * @returns Record of diagram name to rendered SVG
 */
export async function renderDiagrams(
  diagrams: DiagramInput[],
  tempDir: string,
): Promise<Record<string, RenderedDiagram>> {
  const result: Record<string, RenderedDiagram> = {};

  for (const diagram of diagrams) {
    result[diagram.name] = await renderSingleDiagram(
      diagram.mermaid,
      diagram.name,
      tempDir,
    );
  }

  return result;
}
