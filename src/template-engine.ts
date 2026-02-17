// =============================================================================
// template-engine.ts -- Handlebars Template Compilation
// =============================================================================

import Handlebars from 'handlebars';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PdfReporterError,
  type PipelineContext,
} from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '..', 'templates');
const STYLES_DIR = resolve(__dirname, '..', 'styles');

/** Cached two-pass render function: report template -> body, base wraps body + styles */
type CachedRenderer = (context: PipelineContext) => string;

// Cache for fully-assembled render functions (report + base + css + helpers + partials)
const renderCache = new Map<string, CachedRenderer>();

/**
 * Create a configured Handlebars environment with partials and helpers.
 */
async function createHbsEnvironment(): Promise<typeof Handlebars> {
  const hbs = Handlebars.create();

  // Load partials
  const partialsDir = join(TEMPLATES_DIR, 'partials');
  try {
    const partialFiles = await readdir(partialsDir);
    for (const file of partialFiles) {
      if (!file.endsWith('.hbs')) continue;
      const name = file.replace('.hbs', '');
      const content = await readFile(join(partialsDir, file), 'utf-8');
      hbs.registerPartial(name, content);
    }
  } catch {
    // Partials directory may not exist, continue
  }

  // Register helpers
  hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b);

  hbs.registerHelper('formatDate', (dateStr?: string) => {
    if (!dateStr) {
      const now = new Date();
      return now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  return hbs;
}

/**
 * Compile and render Handlebars template with context.
 * @param context - Pipeline context with content, diagrams, meta, options
 * @param templateName - Template name (e.g., 'generic')
 * @returns Rendered HTML
 */
export async function compileTemplate(
  context: PipelineContext,
  templateName: string,
): Promise<string> {
  // Check cache
  const cached = renderCache.get(templateName);
  if (cached) {
    return cached(context);
  }

  // Create Handlebars environment with partials and helpers
  const hbs = await createHbsEnvironment();

  // Load CSS
  const css = await readFile(join(STYLES_DIR, 'report.css'), 'utf-8');

  // Load report template
  const reportTemplatePath = join(
    TEMPLATES_DIR,
    'reports',
    `${templateName}.hbs`,
  );
  let reportTemplate: string;
  try {
    reportTemplate = await readFile(reportTemplatePath, 'utf-8');
  } catch {
    throw new PdfReporterError(
      'TEMPLATE_NOT_FOUND',
      `Report template not found: templates/reports/${templateName}.hbs`,
    );
  }

  // Load base template
  const baseTemplate = await readFile(
    join(TEMPLATES_DIR, 'base.hbs'),
    'utf-8',
  );

  // Compile both templates
  const compiledReport = hbs.compile(reportTemplate);
  const compiledBase = hbs.compile(baseTemplate);

  // Create a two-pass render function and cache it
  const renderer: CachedRenderer = (ctx: PipelineContext): string => {
    const bodyHtml = compiledReport(ctx);
    return compiledBase({
      ...ctx,
      body: bodyHtml,
      styles: css,
    });
  };

  renderCache.set(templateName, renderer);

  return renderer(context);
}
