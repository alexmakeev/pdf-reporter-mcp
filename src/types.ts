// =============================================================================
// types.ts -- PDF Reporter MCP Server Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Callout Types
// -----------------------------------------------------------------------------

export type CalloutType =
  | 'idea'
  | 'automation'
  | 'warning'
  | 'success'
  | 'info'
  | 'critical'
  | 'business'
  | 'expert'
  | 'tip';

export interface CalloutDefinition {
  /**
   * Leading glyph for the callout title. Colors are owned entirely by the CSS
   * design system (`styles/report.css` `.callout-<type>`), NOT inlined here —
   * so a single source of truth styles callouts and the dark theme can recolor
   * them (inline styles would win by specificity and block theming).
   */
  readonly emoji: string;
}

export type CalloutRegistry = Record<CalloutType, CalloutDefinition>;

// -----------------------------------------------------------------------------
// MCP Tool Input/Output
// -----------------------------------------------------------------------------

export interface GeneratePdfInput {
  /** Document title (appears on cover page) */
  title: string;
  /** Document subtitle (optional, appears below title) */
  subtitle?: string;
  /** Logo as data URI or absolute file path (optional) */
  logo?: string;
  /** Pre-rendered HTML content (from render_content tool) */
  content: string;
  /** Template name (default: 'generic') */
  template?: string;
  /** PDF generation options */
  options?: PdfOptions;
}

// -----------------------------------------------------------------------------
// Granular MCP Tool Inputs/Outputs
// -----------------------------------------------------------------------------

export interface RenderDiagramOutput {
  /** Diagram identifier */
  name: string;
  /** Rendered SVG string */
  svg: string;
}

export interface RenderContentInput {
  /** Markdown content with optional :::callout syntax and {{diagram:name}} placeholders */
  markdown: string;
  /** Pre-rendered diagrams to insert at {{diagram:name}} placeholders */
  diagrams?: RenderDiagramOutput[];
}

export interface RenderContentOutput {
  /** Rendered HTML content */
  html: string;
}

export type ColorScheme = 'light' | 'dark';

export interface PdfOptions {
  /** Page size, e.g. 'A4', 'Letter' */
  pageSize?: string;
  /** Color scheme for the document. 'light' (default) or 'dark'. */
  theme?: ColorScheme;
  /** Whether to generate table of contents */
  toc?: boolean;
  /** Custom header template HTML or false to disable */
  headerTemplate?: string | false;
  /** Custom footer template HTML or false to disable */
  footerTemplate?: string | false;
  /** Page margins */
  margins?: PageMargins;
}

export interface PageMargins {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

export interface GeneratePdfOutput {
  /** Absolute path to generated PDF file */
  path: string;
  /** Human-readable file size, e.g. '2.4 MB' */
  size: string;
  /** Number of pages in the generated PDF */
  pages?: number;
}

export interface ListTemplatesOutput {
  templates: TemplateInfo[];
}

export interface TemplateInfo {
  /** Template identifier */
  name: string;
  /** Human-readable description */
  description: string;
}

export interface GetTemplateSchemaInput {
  template: string;
}

export interface GetTemplateSchemaOutput {
  required: string[];
  optional: string[];
}

// -----------------------------------------------------------------------------
// Pipeline Internal Types
// -----------------------------------------------------------------------------

export interface RenderedDiagram {
  readonly type: 'rendered-diagram';
  readonly svg: string;
}

/** Context object passed through pipeline stages */
export interface PipelineContext {
  /** Rendered HTML content (main body) */
  content: string;
  /** Rendered diagrams keyed by name */
  diagrams: Record<string, RenderedDiagram>;
  /** Report metadata for cover page */
  meta: ReportMeta;
  /** PDF generation options with defaults applied */
  options: ResolvedPdfOptions;
  /** Theme configuration */
  theme: ThemeConfig;
}

export interface ReportMeta {
  title: string;
  subtitle?: string;
  logo?: string;
  date?: string;
}

export interface ResolvedPdfOptions {
  pageSize: string;
  theme: ColorScheme;
  toc: boolean;
  headerTemplate: string | false;
  footerTemplate: string | false;
  margins: Required<PageMargins>;
}

// -----------------------------------------------------------------------------
// Template Engine
// -----------------------------------------------------------------------------

export interface TemplateData {
  /** HTML body content */
  body: string;
  /** CSS styles to embed */
  styles: string;
  /** Report metadata */
  meta: ReportMeta;
  /** PDF options */
  options: ResolvedPdfOptions;
  /** Rendered content HTML */
  content: string;
  /** Rendered diagrams */
  diagrams: Record<string, RenderedDiagram>;
  /** Theme configuration */
  theme: ThemeConfig;
}

// -----------------------------------------------------------------------------
// PDF Generator
// -----------------------------------------------------------------------------

export interface PdfGeneratorOptions {
  /** Output directory for the generated PDF */
  outputDir: string;
  /** Filename without extension */
  filename: string;
  /** Resolved PDF options */
  options: ResolvedPdfOptions;
}

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export type PdfErrorCode =
  | 'VALIDATION_ERROR'
  | 'TEMPLATE_NOT_FOUND'
  | 'MARKDOWN_PARSE_FAILED'
  | 'TEMPLATE_COMPILE_FAILED'
  | 'PDF_GENERATION_FAILED'
  | 'INTERNAL_ERROR';

export class PdfReporterError extends Error {
  constructor(
    public readonly code: PdfErrorCode,
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PdfReporterError';
  }
}

// -----------------------------------------------------------------------------
// Theme Configuration
// -----------------------------------------------------------------------------

export interface ThemeConfig {
  /** Primary accent color (default: #4169E1 Royal Blue) */
  primaryColor: string;
  /** Cover page background color (default: same as primaryColor) */
  coverColor: string;
  /** Auto-generated harmonious palette for diagrams and charts */
  palette: string[];
}

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#4169E1',
  coverColor: '#4169E1',
  palette: [], // will be computed at runtime
};

// -----------------------------------------------------------------------------
// Server Configuration
// -----------------------------------------------------------------------------

export interface ServerConfig {
  /** MCP transport type */
  transport: 'stdio' | 'sse';
  /** Port for SSE transport */
  port: number;
  /** Directory for generated PDFs */
  outputDir: string;
  /** Directory for temporary mermaid files */
  tempDir: string;
  /** Theme configuration */
  theme: ThemeConfig;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const DEFAULT_MARGINS: Required<PageMargins> = {
  top: '17mm',
  bottom: '17mm',
  left: '13mm',
  right: '13mm',
};

export const DEFAULT_PAGE_SIZE = 'A4';

export const CALLOUT_TYPES: CalloutRegistry = {
  idea:       { emoji: '💡' },
  automation: { emoji: '🤖' },
  warning:    { emoji: '⚠️' },
  success:    { emoji: '✅' },
  info:       { emoji: 'ℹ️' },
  critical:   { emoji: '🔴' },
  business:   { emoji: '💰' },
  expert:     { emoji: '🔍' },
  tip:        { emoji: '💎' },
};
