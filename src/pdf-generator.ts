// =============================================================================
// pdf-generator.ts -- Generate PDF from HTML using Puppeteer
// =============================================================================

import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  PdfReporterError,
  type PdfGeneratorOptions,
} from './types.js';

/**
 * Format file size in human-readable format.
 * @param bytes - File size in bytes
 * @returns Formatted string like "2.4 MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generate PDF from HTML content.
 * @param html - Complete HTML document
 * @param options - PDF generation options
 * @returns Object with path, size, and page count
 */
export async function generatePdf(
  html: string,
  options: PdfGeneratorOptions,
): Promise<{ path: string; size: string; pages: number }> {
  await mkdir(options.outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const date = new Date().toISOString().slice(0, 10);
    const outputPath = join(
      options.outputDir,
      `${options.filename}-${date}.pdf`,
    );

    // Generate PDF into a buffer (single generation)
    const pdfBuffer = await page.pdf({
      format: options.options.pageSize as any,
      margin: {
        top: options.options.margins.top,
        bottom: options.options.margins.bottom,
        left: options.options.margins.left,
        right: options.options.margins.right,
      },
      displayHeaderFooter: true,
      headerTemplate:
        options.options.headerTemplate !== false
          ? options.options.headerTemplate ||
            `<div style="font-size:8px; width:100%; text-align:center; color:#94a3b8; padding:0 20mm;">
             <span>${options.filename.replace(/-/g, ' ')}</span>
           </div>`
          : '<span></span>',
      footerTemplate:
        options.options.footerTemplate !== false
          ? options.options.footerTemplate ||
            `<div style="font-size:8px; width:100%; text-align:center; color:#94a3b8; padding:0 20mm;">
             Page <span class="pageNumber"></span> of <span class="totalPages"></span>
           </div>`
          : '<span></span>',
      printBackground: true,
    });

    // Ensure we have a Node.js Buffer for file writing and string conversion
    const buffer = Buffer.from(pdfBuffer);

    // Write buffer to file
    await writeFile(outputPath, buffer);

    const size = formatFileSize(buffer.length);

    // Estimate page count from PDF binary content
    const pdfString = buffer.toString('latin1');
    const pageMatches = pdfString.match(/\/Type[\s]*\/Page[^s]/g);
    const pages = pageMatches ? pageMatches.length : 1;

    await browser.close();

    return { path: outputPath, size, pages };
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    throw new PdfReporterError(
      'PDF_GENERATION_FAILED',
      `Failed to generate PDF: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined,
    );
  }
}
