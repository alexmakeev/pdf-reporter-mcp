// =============================================================================
// markdown-renderer.test.ts -- Tests for Markdown Rendering and Callouts
// =============================================================================

import { describe, it, expect } from 'vitest';
import { processCallouts, renderMarkdown } from '../markdown-renderer.js';

// Callout type definitions mirrored from types.ts for assertion clarity
const CALLOUT_DEFS = {
  idea:       { emoji: '💡', borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  automation: { emoji: '🤖', borderColor: '#14B8A6', backgroundColor: '#F0FDFA' },
  warning:    { emoji: '⚠️', borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  success:    { emoji: '✅', borderColor: '#22C55E', backgroundColor: '#F0FDF4' },
  info:       { emoji: 'ℹ️', borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  critical:   { emoji: '🔴', borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  business:   { emoji: '💰', borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  expert:     { emoji: '🔍', borderColor: '#8B5CF6', backgroundColor: '#F5F3FF' },
  tip:        { emoji: '💎', borderColor: '#06B6D4', backgroundColor: '#ECFEFF' },
} as const;

describe('markdown-renderer', () => {
  describe('processCallouts', () => {
    it('should parse basic callout with all 9 types', async () => {
      const types = ['idea', 'automation', 'warning', 'success', 'info', 'critical', 'business', 'expert', 'tip'] as const;

      for (const type of types) {
        const markdown = `:::${type} Test Title\nTest content\n:::`;
        const result = await processCallouts(markdown);
        const def = CALLOUT_DEFS[type];

        expect(result).toContain(`class="callout callout-${type}"`);
        expect(result).toContain(`border-left: 4px solid ${def.borderColor}`);
        expect(result).toContain(`background: ${def.backgroundColor}`);
        expect(result).toContain(`<span class="callout-icon">${def.emoji}</span>`);
        expect(result).toContain('<div class="callout-title"');
        expect(result).toContain('display: flex');
        expect(result).toContain('Test Title');
        expect(result).toContain('Test content');
      }
    });

    it('should render callout title in callout-title div with flex layout', async () => {
      const markdown = ':::info My Title\nSome content\n:::';
      const result = await processCallouts(markdown);

      // Title div must have display: flex
      expect(result).toContain('display: flex');
      // Icon and title are inside the callout-title div
      expect(result).toContain('<div class="callout-title"');
      expect(result).toContain('<span class="callout-icon">ℹ️</span> My Title');
      expect(result).toContain('</div>');
    });

    it('should handle empty callout body', async () => {
      const markdown = ':::info Empty Callout\n:::';
      const result = await processCallouts(markdown);

      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Empty Callout');
      // No body content — callout-body div must NOT be present
      expect(result).not.toContain('<div class="callout-body"');
    });

    it('should default unknown callout type to info styling', async () => {
      const markdown = ':::unknown Test Title\nTest content\n:::';
      const result = await processCallouts(markdown);

      // Class uses the actual type name
      expect(result).toContain('class="callout callout-unknown"');
      // But styling falls back to info definition
      expect(result).toContain('border-left: 4px solid #3B82F6');
      expect(result).toContain('background: #EFF6FF');
      // Info emoji applied as fallback
      expect(result).toContain('<span class="callout-icon">ℹ️</span>');
    });

    it('should handle multiple callouts with distinct border colors', async () => {
      const markdown = `
:::idea First Idea
Content 1
:::

Some text in between

:::warning Second Warning
Content 2
:::
`;
      const result = await processCallouts(markdown);

      // Idea callout
      expect(result).toContain('callout-idea');
      expect(result).toContain('border-left: 4px solid #F59E0B');
      expect(result).toContain('background: #FFFBEB');
      expect(result).toContain('<span class="callout-icon">💡</span> First Idea');
      expect(result).toContain('Content 1');

      // Warning callout
      expect(result).toContain('callout-warning');
      expect(result).toContain('border-left: 4px solid #F97316');
      expect(result).toContain('background: #FFF7ED');
      expect(result).toContain('<span class="callout-icon">⚠️</span> Second Warning');
      expect(result).toContain('Content 2');
    });

    it('should handle callout with nested markdown (bold, lists, code)', async () => {
      const markdown = `:::info Nested Markdown
**Bold text**

- List item 1
- List item 2

\`inline code\`
:::`;
      const result = await processCallouts(markdown);

      expect(result).toContain('callout-info');
      expect(result).toContain('<span class="callout-icon">ℹ️</span> Nested Markdown');

      // Nested content must be inside callout-body div
      const bodyStart = result.indexOf('<div class="callout-body"');
      const bodyEnd = result.indexOf('</div>', bodyStart);
      expect(bodyStart).toBeGreaterThan(-1);
      const bodyContent = result.substring(bodyStart, bodyEnd);

      expect(bodyContent).toContain('<strong>Bold text</strong>');
      expect(bodyContent).toContain('<ul>');
      expect(bodyContent).toContain('<li>List item 1</li>');
      expect(bodyContent).toContain('<li>List item 2</li>');
      expect(bodyContent).toContain('<code>inline code</code>');
    });

    it('should NOT process callout inside code block', async () => {
      const markdown = `
\`\`\`markdown
:::info This is not a real callout
It's inside a code block
:::
\`\`\`
`;
      const result = await processCallouts(markdown);

      // Callout syntax must not be converted to HTML
      expect(result).not.toContain('class="callout');
      // The literal :::info text must appear in the output
      expect(result).toContain(':::info This is not a real callout');
    });
  });

  describe('renderMarkdown', () => {
    it('should render basic markdown elements', async () => {
      const markdown = `# Heading 1
## Heading 2

This is a paragraph.

- List item 1
- List item 2

**Bold** and *italic*
`;
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<h1');
      expect(result).toContain('Heading 1');
      expect(result).toContain('<h2');
      expect(result).toContain('Heading 2');
      expect(result).toContain('<p>This is a paragraph.</p>');
      expect(result).toContain('<li>List item 1</li>');
      expect(result).toContain('<strong>Bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should add heading IDs for TOC linking (slugified)', async () => {
      const markdown = `# Introduction
## Getting Started
### Advanced Features & Tips
`;
      const result = await renderMarkdown(markdown);

      // Assert exact id attribute values
      expect(result).toContain('<h1 id="introduction">Introduction</h1>');
      expect(result).toContain('<h2 id="getting-started">Getting Started</h2>');
      expect(result).toContain('id="advanced-features-tips"');
    });

    it('should apply syntax highlighting to code blocks', async () => {
      const markdown = `\`\`\`typescript
function hello(): string {
  return "world";
}
\`\`\``;
      const result = await renderMarkdown(markdown);

      // Code block structure with language class
      expect(result).toContain('<pre><code class="language-typescript">');
      // highlight.js must add hljs class to spans inside the code block
      expect(result).toContain('hljs');
      // At minimum one hljs-tagged span should appear (function keyword etc.)
      expect(result).toMatch(/class="hljs-\w+"/);
    });

    it('should process callouts and render markdown together', async () => {
      const markdown = `# Document Title

:::info Important Note
This is an **important** callout with markdown.
:::

Regular paragraph here.
`;
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<h1 id="document-title">Document Title</h1>');
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('border-left: 4px solid #3B82F6');
      expect(result).toContain('<span class="callout-icon">ℹ️</span> Important Note');
      expect(result).toContain('<strong>important</strong>');
      expect(result).toContain('<p>Regular paragraph here.</p>');
    });

    it('should handle code blocks with no language specified', async () => {
      const markdown = `\`\`\`
plain text code
no language
\`\`\``;
      const result = await renderMarkdown(markdown);

      // No language class when language not specified
      expect(result).toContain('<pre><code>');
      // highlight.js auto-detection still runs and adds hljs markup
      expect(result).toContain('hljs');
    });
  });
});
