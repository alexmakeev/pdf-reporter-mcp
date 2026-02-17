// =============================================================================
// markdown-renderer.test.ts -- Tests for Markdown Rendering and Callouts
// =============================================================================

import { describe, it, expect } from 'vitest';
import { processCallouts, renderMarkdown } from '../markdown-renderer.js';

describe('markdown-renderer', () => {
  describe('processCallouts', () => {
    it('should parse basic callout with all 9 types', async () => {
      const types = ['idea', 'automation', 'warning', 'success', 'info', 'critical', 'business', 'expert', 'tip'];

      for (const type of types) {
        const markdown = `:::${type} Test Title\nTest content\n:::`;
        const result = await processCallouts(markdown);

        expect(result).toContain(`class="callout callout-${type}"`);
        expect(result).toContain('Test Title');
        expect(result).toContain('Test content');
      }
    });

    it('should handle empty callout body', async () => {
      const markdown = ':::info Empty Callout\n:::';
      const result = await processCallouts(markdown);

      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Empty Callout');
      expect(result).not.toContain('<div class="callout-body"');
    });

    it('should default unknown callout type to info', async () => {
      const markdown = ':::unknown Test Title\nTest content\n:::';
      const result = await processCallouts(markdown);

      // Should use info styling as fallback
      expect(result).toContain('class="callout callout-unknown"');
      expect(result).toContain('ℹ️'); // info emoji
      expect(result).toContain('#3B82F6'); // info border color
    });

    it('should handle multiple callouts in one document', async () => {
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

      expect(result).toContain('callout-idea');
      expect(result).toContain('First Idea');
      expect(result).toContain('Content 1');
      expect(result).toContain('callout-warning');
      expect(result).toContain('Second Warning');
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
      expect(result).toContain('Nested Markdown');
      expect(result).toContain('<strong>Bold text</strong>');
      expect(result).toContain('<li>List item 1</li>');
      expect(result).toContain('<li>List item 2</li>');
      expect(result).toContain('<code>inline code</code>');
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

      // Should preserve the original text, not convert to callout HTML
      expect(result).not.toContain('class="callout');
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

      expect(result).toContain('id="introduction"');
      expect(result).toContain('id="getting-started"');
      expect(result).toContain('id="advanced-features-tips"');
    });

    it('should apply syntax highlighting to code blocks', async () => {
      const markdown = `\`\`\`typescript
function hello(): string {
  return "world";
}
\`\`\``;
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<pre><code');
      expect(result).toContain('class="language-typescript"');
      // Should contain highlight.js classes
      expect(result).toContain('hljs');
    });

    it('should process callouts and render markdown together', async () => {
      const markdown = `# Document Title

:::info Important Note
This is an **important** callout with markdown.
:::

Regular paragraph here.
`;
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<h1');
      expect(result).toContain('Document Title');
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Important Note');
      expect(result).toContain('<strong>important</strong>');
      expect(result).toContain('<p>Regular paragraph here.</p>');
    });

    it('should handle code blocks with no language specified', async () => {
      const markdown = `\`\`\`
plain text code
no language
\`\`\``;
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<pre><code>');
      // Should still apply auto-detection highlighting
      expect(result).toContain('hljs');
    });
  });
});
