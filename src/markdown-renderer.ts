// =============================================================================
// markdown-renderer.ts -- Markdown to HTML renderer with callout support
// =============================================================================

import { Marked } from 'marked';
import hljs from 'highlight.js';
import type { CalloutType } from './types.js';
import { CALLOUT_TYPES } from './types.js';

// -----------------------------------------------------------------------------
// Callout Parser
// -----------------------------------------------------------------------------

interface CalloutMatch {
  fullMatch: string;
  type: string;
  title: string;
  body: string;
}

/**
 * Parse callout blocks from markdown text.
 * Callouts have syntax: :::type Title\nContent\n:::
 */
function extractCallouts(text: string): CalloutMatch[] {
  const calloutRegex = /^:::(\w+)\s+(.*?)\n([\s\S]*?)^:::$/gm;
  const matches: CalloutMatch[] = [];

  let match: RegExpExecArray | null;
  while ((match = calloutRegex.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      type: match[1],
      title: match[2],
      body: match[3].trim(),
    });
  }

  return matches;
}

/**
 * Generate HTML for a single callout block.
 */
async function renderCallout(match: CalloutMatch, marked: Marked): Promise<string> {
  const type = match.type as CalloutType;
  const definition = CALLOUT_TYPES[type] ?? CALLOUT_TYPES.info;

  const { emoji, borderColor, backgroundColor, titleColor, bodyColor } = definition;

  const containerStyle = [
    `border-left: 4px solid ${borderColor}`,
    `background: ${backgroundColor}`,
    'padding: 16px 20px',
    'margin: 20px 0',
    'border-radius: 8px',
    'page-break-inside: avoid',
  ].join('; ');

  const titleStyle = [
    'font-weight: 700',
    'font-size: 15px',
    `color: ${titleColor}`,
    'margin-bottom: 8px',
  ].join('; ');

  const bodyStyle = [
    `color: ${bodyColor}`,
    'font-size: 14px',
    'line-height: 1.6',
  ].join('; ');

  let html = `<div class="callout callout-${type}" style="${containerStyle}">`;
  html += `<div class="callout-title" style="${titleStyle}">`;
  html += `<span class="callout-icon">${emoji}</span> ${match.title}`;
  html += '</div>';

  if (match.body) {
    const bodyHtml = await marked.parse(match.body);
    html += `<div class="callout-body" style="${bodyStyle}">${bodyHtml}</div>`;
  }

  html += '</div>';

  return html;
}

/**
 * Process callouts in markdown text, returning markdown with callout blocks replaced by HTML.
 */
export async function processCallouts(markdown: string): Promise<string> {
  // Find all top-level code blocks to avoid processing callouts inside them
  const codeBlockRanges: Array<{ start: number; end: number }> = [];
  const codeBlockRegex = /^```[\s\S]*?^```$/gm;

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    codeBlockRanges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Helper to check if a position is inside a code block (uses original markdown positions)
  const isInCodeBlock = (pos: number): boolean => {
    return codeBlockRanges.some(range => pos >= range.start && pos < range.end);
  };

  // Create a marked instance for rendering callout bodies
  const marked = createMarkedInstance();

  // Find and process callouts that are NOT inside code blocks
  const callouts = extractCallouts(markdown);

  // First, determine which callouts to process (using original string positions)
  const calloutsToProcess: CalloutMatch[] = [];
  for (const callout of callouts) {
    const calloutIndex = markdown.indexOf(callout.fullMatch);
    if (calloutIndex !== -1 && !isInCodeBlock(calloutIndex)) {
      calloutsToProcess.push(callout);
    }
  }

  // Process callouts in reverse order to maintain correct indices after replacement
  let result = markdown;
  for (let i = calloutsToProcess.length - 1; i >= 0; i--) {
    const callout = calloutsToProcess[i];
    const calloutIndex = result.indexOf(callout.fullMatch);

    if (calloutIndex !== -1) {
      const html = await renderCallout(callout, marked);
      result = result.substring(0, calloutIndex) + html + result.substring(calloutIndex + callout.fullMatch.length);
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Markdown Renderer
// -----------------------------------------------------------------------------

/**
 * Create a configured marked instance with syntax highlighting and custom rendering.
 */
function createMarkedInstance(): Marked {
  const marked = new Marked();

  // Enable GitHub Flavored Markdown
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  // Configure code highlighting
  marked.use({
    renderer: {
      code({ text, lang }: { text: string; lang?: string }): string {
        let highlighted: string;

        if (lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } else {
          highlighted = hljs.highlightAuto(text).value;
        }

        const langClass = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${langClass}>${highlighted}</code></pre>`;
      },

      heading({ text, depth }: { text: string; depth: number }): string {
        const slug = slugify(text);
        return `<h${depth} id="${slug}">${text}</h${depth}>`;
      },
    },
  });

  return marked;
}

/**
 * Convert heading text to URL-friendly slug for TOC linking.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Full markdown rendering pipeline: process callouts, then render markdown to HTML.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  // Step 1: Process callouts (converts callout blocks to HTML)
  const withCallouts = await processCallouts(markdown);

  // Step 2: Render remaining markdown to HTML
  const marked = createMarkedInstance();
  const html = await marked.parse(withCallouts);

  return html;
}
