# Developer Guide

## Prerequisites

- Node.js 20+ (recommended: 20.17.0+)
- npm 9+ or npm 10+
- Chrome/Chromium (Puppeteer downloads automatically on `npm install`)
- ~500MB free disk space for dependencies

## Setup

```bash
git clone git@github.com:alexmakeev/pdf-reporter-mcp.git
cd pdf-reporter-mcp
npm install
```

Puppeteer will download Chrome during installation. First run takes ~30 seconds.

## Development

### Running locally with hot reload

```bash
npm run dev
```

Server starts on stdio transport. Attach with Claude Desktop or test via stdin.

### Build and run production build

```bash
npm run build
npm start
```

Compiled code goes to `dist/`. Run `npm start` to start the production server.

## Testing

### Run all tests once

```bash
npm test
```

### Watch mode (auto-rerun on file changes)

```bash
npm run test:watch
```

### Test coverage report

```bash
npm run test:coverage
```

Coverage reports in `coverage/` directory. Coverage target: >80%.

### Test structure

- Tests in `src/__tests__/` mirror source structure
- All external calls (Puppeteer, mmdc) are mocked
- Tests must run offline without network/Chrome
- Use vitest syntax (similar to Jest)

Example test:
```typescript
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown-renderer';

describe('renderMarkdown', () => {
  it('should convert markdown to HTML', async () => {
    const result = await renderMarkdown('# Hello\n\nWorld');
    expect(result).toContain('<h1');
    expect(result).toContain('World');
  });
});
```

## Architecture

### MCP Tools (Public API)

The server exposes 5 MCP tools that compose the rendering pipeline:

1. **render_diagram(mermaid)** — Mermaid → SVG
   - Single diagram rendering
   - Used before render_content

2. **render_content(content, diagrams)** — Markdown + callouts + SVG → HTML
   - Takes rendered SVGs from step 1
   - Replaces `{{diagram:name}}` placeholders
   - Returns ready-to-use HTML

3. **generate_pdf(title, html, ...)** — HTML + metadata → PDF
   - Compiles Handlebars template
   - Uses Puppeteer for PDF generation
   - Returns path, size, pages

4. **list_templates()** — Returns available templates

5. **get_template_schema(template)** — Returns schema for template

### Internal Pipeline

`generatePdfPipeline(input)` orchestrates rendering for single-call use:

1. **Resolve Options** — Merge with defaults (DEFAULT_MARGINS, DEFAULT_PAGE_SIZE)
   - Source: `src/config-loader.ts`

2. **Render Diagrams** — Mermaid → SVG via mmdc CLI
   - Source: `src/mermaid-renderer.ts`
   - Input: `{ name: string, mermaid: string }[]`
   - Output: `Record<string, RenderedDiagram>`

3. **Render Markdown** — Callouts + highlight.js → HTML
   - Source: `src/markdown-renderer.ts`
   - Callout syntax: `:::type Title\nContent\n:::`
   - 9 callout types with emojis and colors

4. **Replace Placeholders** — `{{diagram:name}}` → SVG content
   - Source: `src/pipeline.ts`

5. **Create Metadata** — Title, subtitle, logo, date (ISO format)
   - Source: `src/pipeline.ts`

6. **Compile Template** — Handlebars with theme context
   - Source: `src/template-engine.ts`
   - Templates: `templates/base.hbs` + `templates/reports/generic.hbs`

7. **Generate PDF** — Puppeteer headless Chrome → PDF file
   - Source: `src/pdf-generator.ts`
   - Output: `/tmp/pdf-reporter-output/` (configurable)

### Theme Variables

Theme colors configurable via environment variables:

- `THEME_PRIMARY_COLOR` — Accent color for headings, callouts, links (default: `#4169E1`)
- `THEME_COVER_COLOR` — Cover page background (default: same as primary)

Applied to CSS at compile time. See `styles/report.css` for usage.

## Extending the Project

### Adding a New Callout Type

1. Add type to `CalloutType` union in `src/types.ts`:
   ```typescript
   export type CalloutType = 'info' | 'warning' | 'success' | 'mynewtype';
   ```

2. Add styling to `CALLOUT_TYPES` registry in `src/types.ts`:
   ```typescript
   mynewtype: {
     emoji: '🎯',
     borderColor: '#6366F1',
     backgroundColor: '#EEF2FF',
     titleColor: '#4F46E5',
     bodyColor: '#312E81'
   }
   ```

3. Add test in `src/__tests__/markdown-renderer.test.ts` to verify callout renders.

### Adding a New Template

1. Create `templates/reports/{name}.hbs`:
   ```handlebars
   {{!-- Custom report template --}}
   <h1>{{meta.title}}</h1>
   <article>{{{content}}}</article>
   ```

2. Register in `src/server.ts` `list_templates` handler (line 216-223):
   ```typescript
   templates: [
     { name: 'generic', description: '...' },
     { name: 'mynewtemplate', description: 'Custom template' }
   ]
   ```

3. Add schema in `src/server.ts` `get_template_schema` handler (line 236-253):
   ```typescript
   if (input.template === 'mynewtemplate') {
     return {
       required: ['title', 'content'],
       optional: ['subtitle', 'logo', 'options']
     };
   }
   ```

4. Update `src/template-engine.ts` to load your template.

## Docker Development

### Build image locally

```bash
docker build -t pdf-reporter-mcp:dev .
```

### Run container

```bash
docker run -it --rm \
  -v pdf-output:/app/output \
  pdf-reporter-mcp:dev
```

### Run with docker-compose

```bash
docker compose up
```

Runs on port 3000 with SSE transport for Dokploy integration.

## Troubleshooting

### Puppeteer Chrome errors on startup

**Error:** `Error: Could not find Chromium`

**Solution:**
1. Reinstall dependencies: `rm -rf node_modules && npm install`
2. Puppeteer should download Chrome during install
3. Check Chrome is executable: `ls -la ~/.cache/puppeteer/*/chrome/linux-*/chrome`
4. If missing, manually download: `npx puppeteer browsers install chrome`

### Mermaid rendering fails

**Error:** `mmdc: command not found`

**Solution:**
1. Ensure mermaid-cli is installed: `npm ls @mermaid-js/mermaid-cli`
2. Run `npm install` to reinstall
3. Check it's available: `npx mmdc --version`
4. In Docker, ensure Chrome is installed (Dockerfile handles this)

### Tests fail with timeout

**Error:** `Test timeout exceeded`

**Solution:**
1. Increase timeout in test file: `{ timeout: 10000 }`
2. Check that all Puppeteer calls are mocked
3. Run with more verbosity: `npm test -- --reporter=verbose`

### PDF generation creates empty files

**Error:** Generated PDF is 0 bytes

**Solution:**
1. Check template is valid HTML: `npm test`
2. Verify Puppeteer Chrome can access system fonts
3. Check disk space: `df -h`
4. Check output directory permissions: `ls -la /tmp/pdf-reporter-output/`

## Environment Variables

Development defaults:
- `NODE_ENV` — `development` (for logging)
- `OUTPUT_DIR` — `/tmp/pdf-reporter-output`
- `TEMP_DIR` — system temp dir (auto-cleaned)
- `PORT` — `3000` (for SSE in Docker)
- `TRANSPORT` — `stdio` (default, change to `sse` for HTTP)
- `PUPPETEER_EXECUTABLE_PATH` — auto-detected (set to override)

## Performance Notes

- First PDF generation takes ~2-3 seconds (Chrome startup + rendering)
- Subsequent PDFs ~1-2 seconds
- Large documents (100+ pages) may take longer
- Mermaid complex diagrams may take 1-2 seconds per diagram
- Temp files auto-cleaned after pipeline completes
