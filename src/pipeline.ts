// =============================================================================
// pipeline.ts -- PDF Generation Pipeline
// =============================================================================

import { join } from 'node:path';
import { resolveOptions } from './config-loader.js';
import { renderMarkdown } from './markdown-renderer.js';
import { compileTemplate } from './template-engine.js';
import { generatePdf as generatePdfFile } from './pdf-generator.js';
import { generatePalette } from './color-utils.js';
import {
  PdfReporterError,
  DEFAULT_THEME,
  type RenderContentInput,
  type RenderContentOutput,
  type GeneratePdfInput,
  type GeneratePdfOutput,
  type PipelineContext,
  type ReportMeta,
  type ThemeConfig,
} from './types.js';

// -----------------------------------------------------------------------------
// Theme Helpers
// -----------------------------------------------------------------------------

/**
 * Load theme configuration from environment variables, falling back to defaults.
 */
function getThemeConfig(): ThemeConfig {
  const primaryColor = process.env['THEME_PRIMARY_COLOR'] ?? DEFAULT_THEME.primaryColor;
  const coverColor = process.env['THEME_COVER_COLOR'] ?? primaryColor;
  const palette = generatePalette(primaryColor);
  return { primaryColor, coverColor, palette };
}

// -----------------------------------------------------------------------------
// Step 1: render_content
// -----------------------------------------------------------------------------

/**
 * Render markdown content to HTML.
 * Processes callout blocks, replaces {{diagram:name}} placeholders with SVG, renders markdown.
 */
export async function renderContent(input: RenderContentInput): Promise<RenderContentOutput> {
  let html = await renderMarkdown(input.markdown);

  if (input.diagrams) {
    for (const diagram of input.diagrams) {
      const placeholder = `{{diagram:${diagram.name}}}`;
      html = html.replaceAll(
        placeholder,
        `<div class="diagram-container"><div class="diagram-svg">${diagram.svg}</div></div>`,
      );
    }
  }

  return { html };
}

// -----------------------------------------------------------------------------
// Step 2: generate_pdf
// -----------------------------------------------------------------------------

/**
 * Generate a PDF from pre-rendered HTML content.
 * Wraps content in the chosen template, applies theme, and writes the PDF file.
 */
export async function generatePdfFromHtml(input: GeneratePdfInput): Promise<GeneratePdfOutput> {
  const resolvedOptions = resolveOptions(input);
  const theme = getThemeConfig();

  const meta: ReportMeta = {
    title: input.title,
    subtitle: input.subtitle,
    logo: input.logo,
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };

  const context: PipelineContext = {
    content: input.content,
    diagrams: {},
    meta,
    options: resolvedOptions,
    theme,
  };

  const templateName = input.template ?? 'generic';
  const fullHtml = await compileTemplate(context, templateName);

  const outputDir = process.env['OUTPUT_DIR'] ?? join(process.cwd(), 'output');
  const filename = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '');

  const result = await generatePdfFile(fullHtml, {
    outputDir,
    filename,
    options: resolvedOptions,
  });

  return {
    path: result.path,
    size: result.size,
    pages: result.pages,
  };
}

// -----------------------------------------------------------------------------
// Monolithic pipeline (backward compat)
// -----------------------------------------------------------------------------

/**
 * Full end-to-end PDF generation pipeline.
 * Renders diagrams, renders markdown, wraps in template, generates PDF.
 * Kept for backward compatibility; prefer the granular functions above.
 */
export async function generatePdfPipeline(input: GeneratePdfInput): Promise<GeneratePdfOutput> {
  try {
    return await generatePdfFromHtml(input);
  } catch (err) {
    if (err instanceof PdfReporterError) {
      throw err;
    }
    throw new PdfReporterError(
      'INTERNAL_ERROR',
      `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined,
    );
  }
}
