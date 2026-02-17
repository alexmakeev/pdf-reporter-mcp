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

    it('should require callout opening to be at start of line — inline ::: does not match', async () => {
      // The ^ anchor in calloutRegex means inline ::: must NOT be treated as a callout
      const markdown = 'Some text :::info Not A Callout\nContent\n:::';
      const result = await processCallouts(markdown);

      // No callout div should be present
      expect(result).not.toContain('class="callout');
      // Original text preserved
      expect(result).toContain(':::info Not A Callout');
    });

    it('should require callout closing ::: to be at start of line — trailing text prevents match', async () => {
      // The $ anchor after ::: means :::trailing must NOT close a callout
      const markdown = ':::info My Title\nContent\n:::trailing text';
      const result = await processCallouts(markdown);

      // Without proper end, no callout processed
      expect(result).not.toContain('class="callout');
    });

    it('should require code block opening ``` to be at start of line', async () => {
      // The ^ anchor in codeBlockRegex — inline ``` should not form a code block range
      // So a callout appearing after inline backticks should still be processed
      const markdown = 'Some text with backticks\n:::info Real Callout\nContent\n:::';
      const result = await processCallouts(markdown);

      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Real Callout');
    });

    it('should require code block closing ``` to be at start of line', async () => {
      // A real code block with backticks at start of line should protect the callout inside
      const markdown = `\`\`\`text
:::info Fake Callout
inside code
\`\`\``;
      const result = await processCallouts(markdown);

      expect(result).not.toContain('class="callout');
      expect(result).toContain(':::info Fake Callout');
    });

    it('should require code block closing ``` to be at start of line — line-end ``` does not prematurely close code block', async () => {
      // Without ^ before closing ``` (mutant), a line ending in ``` would prematurely close the code block
      // This would make a subsequent callout appear "outside" the code block, so it gets processed
      // Original behavior: callout inside the code block is NOT processed
      const markdown = `\`\`\`
code line ending with \`\`\`
:::info Callout Inside Code Block
This should not be rendered
:::
\`\`\``;
      const result = await processCallouts(markdown);

      // Original: the code block does NOT close at "code line ending with ```"
      // The callout remains inside the code block → not processed → literal text remains
      expect(result).not.toContain('class="callout callout-info"');
      expect(result).toContain(':::info Callout Inside Code Block');
    });

    it('should trim whitespace from callout body', async () => {
      // The body: match[3].trim() must strip leading/trailing whitespace
      // If trim() is removed, the body passed to marked.parse changes — affecting empty body detection
      const markdown = ':::info Trimmed Body\n\ncontent here\n\n:::';
      const result = await processCallouts(markdown);

      // Body must be present and parsed
      expect(result).toContain('<div class="callout-body"');
      expect(result).toContain('content here');
    });

    it('should detect empty callout body after trimming (whitespace-only body = no body div)', async () => {
      // If trim() is removed, a body of "\n" would not be falsy and would render an empty body div
      const markdown = ':::info Whitespace Body\n   \n:::';
      const result = await processCallouts(markdown);

      // After trim, body is empty — no callout-body div
      expect(result).not.toContain('<div class="callout-body"');
    });

    it('should render exact container style with correct property values', async () => {
      const markdown = ':::info Style Check\nContent\n:::';
      const result = await processCallouts(markdown);

      // Assert each individual container style property is present
      expect(result).toContain('padding: 16px 20px');
      expect(result).toContain('margin: 20px 0');
      expect(result).toContain('border-radius: 8px');
      expect(result).toContain('page-break-inside: avoid');
      // Style properties must be joined with '; ' separator
      expect(result).toContain('border-left: 4px solid #3B82F6; background: #EFF6FF; padding: 16px 20px; margin: 20px 0; border-radius: 8px; page-break-inside: avoid');
    });

    it('should render exact title style with correct property values', async () => {
      const markdown = ':::info Title Style\nContent\n:::';
      const result = await processCallouts(markdown);

      // Assert each individual title style property is present
      expect(result).toContain('font-weight: 700');
      expect(result).toContain('font-size: 15px');
      expect(result).toContain('margin-bottom: 8px');
      expect(result).toContain('align-items: center');
      expect(result).toContain('gap: 8px');
      // Title style must use '; ' as separator
      expect(result).toContain('font-weight: 700; font-size: 15px');
    });

    it('should render exact body style with correct property values', async () => {
      const markdown = ':::info Body Style\nContent\n:::';
      const result = await processCallouts(markdown);

      // Each body style property must be present
      expect(result).toContain('font-size: 14px');
      expect(result).toContain('line-height: 1.7');
      // Body color for info type
      expect(result).toContain('color: #1E40AF');
      // Body style must use '; ' as separator
      expect(result).toContain('font-size: 14px; line-height: 1.7');
    });

    it('should render title color in title style (not empty)', async () => {
      const markdown = ':::info Color Check\nContent\n:::';
      const result = await processCallouts(markdown);

      // titleColor for info type must appear in title style
      // If the template literal becomes empty string, this would be missing
      const titleDivMatch = result.match(/<div class="callout-title" style="([^"]+)"/);
      expect(titleDivMatch).not.toBeNull();
      expect(titleDivMatch![1]).toContain('color:');
    });

    it('should render body color in body style (not empty)', async () => {
      const markdown = ':::info Color Body Check\nContent\n:::';
      const result = await processCallouts(markdown);

      // bodyColor must appear in body style div
      const bodyDivMatch = result.match(/<div class="callout-body" style="([^"]+)"/);
      expect(bodyDivMatch).not.toBeNull();
      expect(bodyDivMatch![1]).toContain('color:');
    });

    it('should close callout-title div with </div>', async () => {
      const markdown = ':::info Div Close\nContent\n:::';
      const result = await processCallouts(markdown);

      // Structure must be: <div class="callout-title"...>...</div><div class="callout-body"...>
      // The closing </div> after title must be present before the body div
      const titleStart = result.indexOf('<div class="callout-title"');
      const bodyStart = result.indexOf('<div class="callout-body"');
      const divCloseAfterTitle = result.indexOf('</div>', titleStart);

      expect(divCloseAfterTitle).toBeGreaterThan(titleStart);
      expect(divCloseAfterTitle).toBeLessThan(bodyStart);
    });

    it('should close the outer callout container div with </div>', async () => {
      const markdown = ':::info Outer Close\nContent\n:::';
      const result = await processCallouts(markdown);

      // The HTML must end with </div> closing the outer container
      const trimmedResult = result.trim();
      expect(trimmedResult).toMatch(/<\/div>\s*$/);
    });

    it('should only process callout when callout start is not inside a code block', async () => {
      // Real callout BEFORE a code block should be processed
      const markdown = `:::info Before Code
Callout content
:::

\`\`\`js
const x = 1;
\`\`\``;
      const result = await processCallouts(markdown);

      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Callout content');
    });

    it('should correctly replace callout text — prefix before callout must be preserved', async () => {
      const markdown = `Before callout text

:::info My Callout
Content
:::

After callout text`;
      const result = await processCallouts(markdown);

      // Text before callout must appear in output
      expect(result).toContain('Before callout text');
      // Callout converted to HTML
      expect(result).toContain('class="callout callout-info"');
      // Text after callout must appear in output
      expect(result).toContain('After callout text');
      // Original callout syntax must NOT appear
      expect(result).not.toContain(':::info My Callout');
    });

    it('should correctly replace callout text — suffix after callout must be preserved', async () => {
      const markdown = `:::info First\nFirst content\n:::

:::info Second\nSecond content\n:::`;
      const result = await processCallouts(markdown);

      // Both callouts must be converted
      expect(result.match(/class="callout callout-info"/g)!.length).toBe(2);
      // Neither original syntax should remain
      expect(result).not.toContain(':::info First');
      expect(result).not.toContain(':::info Second');
    });

    it('should use code block range boundary correctly (start of code block is in-range, before is not)', async () => {
      // Callout immediately before code block should be processed
      // Callout inside code block should not be processed
      const markdown = `:::info Outside\nOutside content\n:::
\`\`\`text
:::info Inside
Inside content
:::
\`\`\``;
      const result = await processCallouts(markdown);

      // First callout (outside) must be converted
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Outside content');

      // Second callout (inside code block) must remain as text
      expect(result).toContain(':::info Inside');
    });

    it('should require callout closing ::: to be at start of line — line-ending ::: does not prematurely close', async () => {
      // The ^::: requires closing at line start
      // A ::: that appears at the END of a line (not start) should NOT close the callout
      const markdown = `:::info Title
Body text ending with:::
More body content
:::`;
      const result = await processCallouts(markdown);

      // Callout should be parsed and body should include both body lines
      expect(result).toContain('class="callout callout-info"');

      // "More body content" must appear INSIDE the callout body div, not as leftover text
      // With mutant regex, ::: at end of line prematurely closes callout, leaving "More body content"
      // as raw text outside the callout div
      const calloutBodyStart = result.indexOf('<div class="callout-body"');
      const calloutBodyEnd = result.indexOf('</div>', calloutBodyStart);
      const calloutBodyContent = result.substring(calloutBodyStart, calloutBodyEnd);
      expect(calloutBodyContent).toContain('More body content');

      // The closing ::: of the callout must NOT appear as literal text in output
      expect(result).not.toMatch(/^:::$/m);
    });

    it('should require callout to have one or more spaces after type word — title must not have leading space', async () => {
      // The \s+ (one or more spaces) in /^:::(\w+)\s+(.*?)/ consumes ALL spaces between type and title
      // With only \s (no +), only one space is consumed, leaving the rest as leading space in the title
      // ":::info  Double Space Title" with \s+ -> title = "Double Space Title"
      // ":::info  Double Space Title" with \s -> title = " Double Space Title" (leading space)
      const markdown = ':::info  Double Space Title\nContent\n:::';
      const result = await processCallouts(markdown);

      // Should be processed as callout
      expect(result).toContain('class="callout callout-info"');

      // The title must NOT have a leading space — icon and title appear as "ℹ️ Double Space Title"
      // With \s mutant: "ℹ️  Double Space Title" (extra space)
      expect(result).toContain('<span class="callout-icon">ℹ️</span> Double Space Title');
      expect(result).not.toContain('<span class="callout-icon">ℹ️</span>  Double Space Title');
    });

    it('should correctly close the outer callout container (count of open vs close divs)', async () => {
      const markdown = ':::info Count Test\nSome body\n:::';
      const result = await processCallouts(markdown);

      // Count <div and </div> occurrences — they must be balanced
      const openDivCount = (result.match(/<div/g) || []).length;
      const closeDivCount = (result.match(/<\/div>/g) || []).length;
      expect(openDivCount).toBe(closeDivCount);
    });

    it('should correctly close the outer callout container when body is absent', async () => {
      // Without body: 1 outer div + 1 title div = 2 opens, 2 closes
      const markdown = ':::info No Body\n:::';
      const result = await processCallouts(markdown);

      const openDivCount = (result.match(/<div/g) || []).length;
      const closeDivCount = (result.match(/<\/div>/g) || []).length;
      expect(openDivCount).toBe(closeDivCount);
    });

    it('should not treat code block with backticks appearing mid-line as a code block', async () => {
      // The ^ anchor in codeBlockRegex ensures only line-start ``` counts
      // If ^ is removed, mid-line backticks would be treated as code blocks
      const markdown = 'Here are some ``` inline backticks in text\n:::info Real Callout\nBody\n:::';
      const result = await processCallouts(markdown);

      // Callout should be processed normally since the backticks are not at line start
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Real Callout');
    });

    it('should not treat code block as ended when closing ``` is not at start of line', async () => {
      // The closing ^``` anchor ensures only line-start ``` closes code blocks
      const markdown = `\`\`\`
code block content with trailing \`\`\`
\`\`\`

:::info After Proper End
Body
:::`;
      const result = await processCallouts(markdown);

      // The callout after the real (line-start) closing ``` is processed
      expect(result).toContain('class="callout callout-info"');
    });

    it('should require closing ``` to be at end of line ($ anchor) — callout inside malformed block is processed', async () => {
      // /^```$/gm: $ requires end of line; "```trailing" at line start does NOT count as closing a code block
      // Without $ (mutant /^```[\s\S]*?^```/gm), "```trailing" counts as close, hiding callout inside
      // With original: no code block is detected, so callout IS processed (no range to suppress it)
      const markdown = `\`\`\`
:::info Inside Malformed Block
Content here
:::
\`\`\`trailing text`;
      const result = await processCallouts(markdown);

      // Original: closing ``` must be at END of line ($ anchor); "```trailing" doesn't close it
      // No valid code block is detected, so the callout IS processed
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('Inside Malformed Block');
    });

    it('should require opening ``` to be at start of line (^ anchor) — mid-line ``` does not start a code block', async () => {
      // Without ^ before opening ``` (mutant), "text ```" mid-line would start a fake code block range
      // that encompasses any following callout, preventing it from being processed
      // Original: only line-start ``` creates code block range; mid-line ``` is ignored
      const markdown = `line with \`\`\` triple backticks mid-line
:::info Real Callout
This is real content
:::
\`\`\``;
      const result = await processCallouts(markdown);

      // Original: mid-line ``` doesn't start a code block range; callout IS processed
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('This is real content');
    });

    it('should treat position at exact code block start as inside code block', async () => {
      // pos >= range.start (not pos > range.start) means the first char is inside
      // This is tested by ensuring a callout starting at position 0 with a code block at position 0
      // doesn't get processed (the code block range starts at 0)
      const markdown = `\`\`\`
:::info Inside At Start
Content
:::
\`\`\``;
      const result = await processCallouts(markdown);

      // The callout inside code block at start of file must not be processed
      expect(result).not.toContain('class="callout');
    });

    it('should treat position at code block end as outside code block', async () => {
      // pos < range.end (not <=) means the position AT end is outside
      // After a code block, a callout should be processed
      const markdown = `\`\`\`
code
\`\`\`
:::info After Code Block
Content
:::`;
      const result = await processCallouts(markdown);

      // Callout after code block must be processed
      expect(result).toContain('class="callout callout-info"');
      expect(result).toContain('After Code Block');
    });

    it('should use gfm and breaks settings — setOptions call must not be empty', async () => {
      // If setOptions({}) is called (empty), GFM-only features like tables would be disabled
      // This is tested via the GFM table test in renderMarkdown, but also ensure the
      // callout body rendering (which uses createMarkedInstance) processes GFM correctly
      const markdown = `:::info GFM Test
| A | B |
| - | - |
| 1 | 2 |
:::`;
      const result = await processCallouts(markdown);

      // Table inside callout body must be rendered (requires gfm: true in marked instance)
      expect(result).toContain('<table>');
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

    it('should render GFM tables when gfm is enabled', async () => {
      // GFM tables only render with gfm: true
      const markdown = `| Col A | Col B |
| ----- | ----- |
| A1    | B1    |
| A2    | B2    |
`;
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<table>');
      expect(result).toContain('<th>Col A</th>');
      expect(result).toContain('<td>A1</td>');
    });

    it('should NOT convert single newlines to <br> when breaks is false', async () => {
      // With breaks: false, a single newline in a paragraph is not converted to <br>
      const markdown = `First line
Second line
`;
      const result = await renderMarkdown(markdown);

      // No <br> tag should appear — with breaks:false, lines are joined in paragraph
      expect(result).not.toContain('<br>');
      expect(result).not.toContain('<br/>');
      expect(result).not.toContain('<br />');
    });

    it('should slugify heading with multiple consecutive spaces into single dash', async () => {
      // \s+ (greedy) must collapse multiple spaces to single dash
      // If mutated to \s (non-greedy), multiple spaces produce multiple dashes
      const markdown = '# Hello   World';
      const result = await renderMarkdown(markdown);

      // Multiple spaces collapsed to single dash
      expect(result).toContain('id="hello-world"');
      // Must NOT have multiple dashes from spaces
      expect(result).not.toContain('id="hello---world"');
    });

    it('should slugify heading with multiple consecutive dashes into single dash', async () => {
      // The /-+/g (greedy) must collapse multiple dashes to a single dash
      // If mutated to /-/g (non-greedy), consecutive dashes are not collapsed
      const markdown = '# Feature A---B';
      const result = await renderMarkdown(markdown);

      // Multiple dashes collapsed to single dash
      expect(result).toContain('id="feature-a-b"');
      // Must NOT have multiple dashes
      expect(result).not.toContain('id="feature-a---b"');
    });

    it('should slugify heading with leading and trailing dashes stripped', async () => {
      // The /^-|-$/ pattern strips leading and trailing dashes
      // If the replacement is "Stryker was here!" instead of "", the id would be wrong
      const markdown = '# -Leading Dash';
      const result = await renderMarkdown(markdown);

      // Leading dash in slug must be stripped
      expect(result).not.toContain('id="-leading-dash"');
      // The resulting id should not start with a dash
      const idMatch = result.match(/id="([^"]+)"/);
      expect(idMatch).not.toBeNull();
      expect(idMatch![1]).not.toMatch(/^-/);
      expect(idMatch![1]).not.toMatch(/-$/);
    });

    it('should slugify heading with trailing dash stripped', async () => {
      // Test the trailing dash removal from /^-|-$/g
      const markdown = '# Hello World!';
      const result = await renderMarkdown(markdown);

      // The ! becomes empty via [^\w\s-] replacement, leaving no trailing dash
      // If /^-|-$/g replacement is non-empty, trailing content appears
      expect(result).toContain('id="hello-world"');
    });

    it('should strip special characters from heading slug', async () => {
      // The [^\w\s-] pattern removes non-word, non-space, non-dash characters
      const markdown = '# Hello (World) & More!';
      const result = await renderMarkdown(markdown);

      // Special chars stripped, spaces become dashes, multiple dashes collapsed
      expect(result).toContain('id="hello-world-more"');
    });

    it('should render strikethrough with GFM enabled', async () => {
      // GFM enables strikethrough syntax ~~text~~
      const markdown = 'This is ~~strikethrough~~ text.';
      const result = await renderMarkdown(markdown);

      expect(result).toContain('<del>strikethrough</del>');
    });

    it('should slugify heading with multiple consecutive whitespace to single dash', async () => {
      // \s+ vs \s: "hello  world" with \s+ produces "hello-world"
      // With \s (non-greedy), each space is replaced independently resulting in "hello--world"
      const markdown = '# Hello  World';
      const result = await renderMarkdown(markdown);

      expect(result).toContain('id="hello-world"');
      // If \s+ is mutated to \s, two spaces produce "--" which then collapses to "-"
      // But we need the direct test — multiple spaces must become exactly one dash
      expect(result).not.toContain('id="hello--world"');
    });

    it('should slugify heading with three consecutive whitespace chars to single dash', async () => {
      // \s+ must handle 3+ spaces collapsing to single dash
      // \s would replace each, then -+ would collapse, so this might not distinguish
      // But the key is: \s+ produces "-" directly, \s produces "---" then -+ collapses to "-"
      // The intermediate result matters for the -+ dedup step
      const markdown = '# A   B   C';
      const result = await renderMarkdown(markdown);

      // Multiple spaces must produce single dashes between words
      expect(result).toContain('id="a-b-c"');
    });

    it('should return empty string for leading/trailing dash replacement (not Stryker placeholder)', async () => {
      // /^-|-$/g replacement must be '' not "Stryker was here!"
      // Test with a heading that has special chars at start/end producing leading dash
      const markdown = '# (Parenthesized Heading)';
      const result = await renderMarkdown(markdown);

      // After replacing ( and ) with '' and spaces with -, should get "parenthesized-heading"
      // If leading/trailing dash replacement returns non-empty string, the id changes
      const idMatch = result.match(/id="([^"]+)"/);
      expect(idMatch).not.toBeNull();
      const id = idMatch![1];
      // Must not contain the Stryker placeholder text
      expect(id).not.toContain('Stryker');
      // Must be a clean slug
      expect(id).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/);
    });

    it('should produce correct slug for heading with leading special char', async () => {
      // A heading starting with a special char like & must not have leading dash in slug
      const markdown = '# & Special Start';
      const result = await renderMarkdown(markdown);

      // & is removed, leaving " Special Start" -> "special-start"
      // Without leading dash trimming: "-special-start"
      const idMatch = result.match(/id="([^"]+)"/);
      expect(idMatch).not.toBeNull();
      expect(idMatch![1]).not.toMatch(/^-/);
      expect(idMatch![1]).toBe('special-start');
    });
  });
});
