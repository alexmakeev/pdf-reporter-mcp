# PDF Reporter — MCP Server

Repository: git@github.com:alexmakeev/pdf-reporter-mcp.git

## Vision

A standalone MCP server that generates professional PDF documents from structured content. Deployed as a Docker container on Dokploy, accessible by any Claude Code session via MCP protocol.

## Language Choice: TypeScript (not Rust)

### Why not Rust?
Rust was considered for stability and memory efficiency, but analysis shows it wouldn't help:

1. **Chrome is the memory consumer** — Puppeteer/Chromium uses 200-400MB RAM for PDF rendering. This is identical whether called from Rust or Node.js.
2. **Mermaid requires Node.js** — `@mermaid-js/mermaid-cli` is JS-only, no Rust alternative exists. Even from Rust, you'd need to spawn a Node.js process.
3. **Pipeline is I/O-bound** — read files → send to Chrome → wait for PDF. No CPU-intensive work where Rust shines.
4. **Two runtimes in one container** (Rust + Node.js for Mermaid) adds complexity, not simplicity.

### Why TypeScript?
- **Strict typing** — catches errors at compile time, gives the "strictness" benefit of Rust
- **Single runtime** — Node.js for everything (pipeline, Mermaid, Puppeteer, MCP SDK)
- **Direct migration** — existing reporter is JS, TypeScript migration is straightforward
- **Ecosystem** — all dependencies (Puppeteer, Handlebars, Marked, MCP SDK) are TypeScript-native
- **Simple Docker** — single `FROM node:20`, no multi-stage for compiled binary
- **Testability** — vitest/jest with full type coverage

## Architecture: MCP Server

### Why MCP (not just a skill)
- Runs as Docker container — isolated environment with all dependencies (Chrome, Node.js, fonts)
- Any project can use it via MCP — not tied to setup repo
- Dokploy deployment — production-ready, auto-restart, monitoring
- Scales independently — heavy PDF rendering doesn't block agent

### MCP Tools to expose:
1. `generate_pdf` — main tool: accepts content config, returns PDF file path
2. `list_templates` — list available report templates
3. `get_template_schema` — get required fields for a template

### Transport: stdio (for local) or SSE (for remote Dokploy deployment)

## Technology Stack

From the existing reporter at ~/tmp/report/:
- **TypeScript** (Node.js, ESM modules)
- **Puppeteer** — HTML to PDF via headless Chrome
- **Handlebars** — template engine with partials and helpers
- **Marked** — Markdown to HTML
- **highlight.js** — code syntax highlighting
- **@mermaid-js/mermaid-cli** — diagram rendering (flowcharts, Gantt, sequence, pie, etc.)
- **js-yaml** — YAML config parsing
- **MCP SDK** — `@modelcontextprotocol/sdk` for server implementation
- **typescript** — type checking and compilation
- **tsx** — TypeScript execution for development
- **vitest** — testing framework with TypeScript support
- **@types/node** — Node.js type definitions

## Pipeline (from existing reporter)

```
Input (from MCP tool call)
    ↓
Config validation
    ↓
Data loading (Markdown content + Mermaid .mmd files)
    ↓
Mermaid rendering → SVG
    ↓
Markdown rendering → HTML (with highlight.js)
    ↓
Handlebars template compilation
    ↓
Puppeteer PDF generation
    ↓
Return PDF path via MCP response
```

## Design Requirements

### Title Page (Generic Template)
- **Background color: Royal Blue (#4169E1)**
- Layout: full-viewport flex-centered content
- **Title**: Project name (large, bold, white text, ~32pt)
- **Subtitle**: Document description (up to 2 lines, lighter weight, white/light text, ~16pt)
- **Logo**: Optional — if provided as file path, display above title. If not — title only, no placeholder.
- **Date**: Auto-formatted at bottom
- **Padding**: 60px (current reporter uses 60px on cover page)
- Page break after title page

Existing cover page CSS from reporter (to adapt):
```css
.cover-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  page-break-after: always;
  background: #334155; /* CHANGE TO #4169E1 */
  color: white;
  padding: 60px;
  margin: 0 -10px;
}

.cover-title {
  font-size: 32pt;
  font-weight: 700;
  margin-bottom: 16px;
  line-height: 1.2;
}

.cover-subtitle {
  font-size: 14pt;
  font-weight: 300;
  opacity: 0.85;
  margin-bottom: 48px;
}

.cover-logo {
  margin-bottom: 40px;
}

.cover-logo img {
  max-width: 190px;
  height: auto;
  opacity: 0.95;
}
```

### Callout Sections (KEY FEATURE)
These are highlighted content blocks with:
- Left border in a distinctive color
- Emoji icon on the left side
- Background tint matching the border color (subtle)
- Bold title + content text

**Predefined callout types:**

| Type | Emoji | Border Color | Use Case |
|------|-------|-------------|----------|
| idea | 💡 | #F59E0B (Amber) | Key insights, innovative approaches |
| automation | 🤖 | #14B8A6 (Teal) | Automation opportunities, AI suggestions |
| warning | ⚠️ | #F97316 (Orange) | Cautions, important caveats |
| success | ✅ | #22C55E (Green) | Achievements, completed milestones |
| info | ℹ️ | #3B82F6 (Blue) | Additional context, explanations |
| critical | 🔴 | #EF4444 (Red) | Critical issues, blockers |
| business | 💰 | #10B981 (Green) | Business value, ROI |
| expert | 🔍 | #8B5CF6 (Purple) | Expert review checkpoints |
| tip | 💎 | #06B6D4 (Cyan) | Pro tips, best practices |

**Markdown syntax for callouts:**
```markdown
:::idea Title of the Insight
Content of the callout box. Can contain **bold**, *italic*, lists, etc.
:::

:::automation Automation Opportunity
This process can be automated using...
:::
```

The Handlebars helper should parse these from Markdown and render as styled blocks.

**Existing callout CSS from reporter** (universal pattern):
```css
.callout {
  display: flex;
  gap: 12px;
  padding: 16px;
  margin: 16px 0;
  border-radius: 6px;
  page-break-inside: avoid;
}

.callout-icon {
  font-size: 18pt;
  flex-shrink: 0;
  line-height: 1;
}

.callout-content {
  flex: 1;
}

.callout-title {
  font-weight: 700;
  font-size: 11pt;
  margin-bottom: 8px;
}

.callout-body {
  font-size: 10pt;
  line-height: 1.5;
}

.callout-body p {
  margin-bottom: 8px;
}

.callout-body ul {
  margin: 8px 0 8px 16px;
}

.callout-body li {
  margin-bottom: 4px;
  font-size: 10pt;
  line-height: 1.4;
}
```

**Example callout type CSS:**
```css
/* AI Tip Callout (Yellow/Amber) */
.callout-ai-tip {
  background: #fffbeb;
  border: 2px solid #f59e0b;
  border-left: 4px solid #f59e0b;
}

.callout-ai-tip .callout-title {
  color: #d97706;
}

.callout-ai-tip .callout-body {
  color: #92400e;
}

/* Business Value Callout (Green) */
.callout-business-value {
  background: #f0fdf4;
  border: 2px solid #059669;
  border-left: 4px solid #059669;
}

.callout-business-value .callout-title {
  color: #047857;
}

.callout-business-value .callout-body {
  color: #065f46;
}

/* Expert Review Checkpoint (Purple) */
.callout-review-checkpoint {
  background: #f5f3ff;
  border: 2px solid #7c3aed;
  border-left: 4px solid #7c3aed;
}

.callout-review-checkpoint .callout-title {
  color: #6d28d9;
}

.callout-review-checkpoint .callout-body {
  color: #5b21b6;
}
```

### Bullet Lists
- Beautiful styling with custom markers (not default browser dots)
- Tree-style nested lists with visual connectors (vertical lines, branches)
- Proper indentation and spacing
- Different markers for different nesting levels (●, ○, ■, □, ▸)

**Tree-style CSS:**
```css
ul {
  list-style: none;
  padding-left: 1.5em;
}

ul > li {
  position: relative;
  padding-left: 0.5em;
}

ul > li::before {
  content: "●";
  color: #4169E1; /* Royal Blue theme */
  position: absolute;
  left: -1em;
}

ul ul > li::before {
  content: "○";
  color: #6B7280;
}

ul ul ul > li::before {
  content: "■";
  color: #9CA3AF;
  font-size: 0.7em;
}

ul ul ul ul > li::before {
  content: "▸";
  color: #D1D5DB;
}

/* Tree connectors */
ul ul {
  border-left: 1px solid #E5E7EB;
  margin-left: 0.2em;
}
```

### Typography
- Professional font stack: `'Segoe UI', system-ui, -apple-system, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'`
- Body: 11pt, line-height 1.6
- Headings: scaled appropriately, with subtle bottom borders
- Code: monospace with background tint, highlight.js for blocks

### Tables
- Alternating row colors
- Responsive column widths
- Header row with Royal Blue background (matching title page theme)
- Rounded corners, subtle shadows

**Existing table CSS from reporter:**
```css
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  page-break-inside: avoid;
}

th {
  background: #f1f5f9; /* CHANGE TO Royal Blue theme */
  font-weight: 600;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid #cbd5e1;
  color: #334155;
}

td {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
}

tr:nth-child(even) td {
  background: #f8fafc;
}
```

### Diagrams (Mermaid)
The subagent prepares .mmd files with diagram definitions BEFORE PDF generation.
Supported diagram types:
- Flowcharts (process flows, decision trees)
- Sequence diagrams (API interactions, message flows)
- Gantt charts (timelines, project plans)
- Pie charts (distribution, statistics)
- Class diagrams (architecture)
- State diagrams (state machines)

Mermaid CLI renders them to SVG → embedded in HTML → print-quality in PDF.

**Existing renderer from reporter:**
- File: `src/mermaid-renderer.mjs`
- Uses `@mermaid-js/mermaid-cli` (`mmdc` binary)
- Input: `.mmd` file with Mermaid syntax
- Output: SVG with transparent background
- Theme: `neutral`
- Error handling: renders error message if diagram fails

### Page Layout
- A4 size (default, configurable)
- Margins: **top/bottom 17mm, left/right 13mm** (from existing reporter)
- Header: document title (small, gray)
- Footer: page number (centered)
- Page break management: avoid orphaned headings, keep sections together

**Existing PDF config from reporter:**
```javascript
await page.pdf({
  path: outputPath,
  format: options?.pageSize || 'A4',
  margin: options?.margins || {
    top: '17mm',
    bottom: '17mm',
    left: '13mm',
    right: '13mm',
  },
  displayHeaderFooter: true,
  headerTemplate: options?.headerTemplate !== false
    ? `<div style="font-size:8px; width:100%; text-align:center; color:#94a3b8; padding:0 20mm;">
         <span>${filename.replace(/-/g, ' ')}</span>
       </div>`
    : '<span></span>',
  footerTemplate: options?.footerTemplate !== false
    ? `<div style="font-size:8px; width:100%; text-align:center; color:#94a3b8; padding:0 20mm;">
         Page <span class="pageNumber"></span> of <span class="totalPages"></span>
       </div>`
    : '<span></span>',
  printBackground: true,
});
```

## Subagent Workflow (in setup-utility skill)

When user requests a PDF:

```
1. User: "Make me a PDF about X"
    ↓
2. Orchestrator (setup-utility) dispatches to PDF workflow
    ↓
3. Content Subagent (Haiku model):
   - Analyzes user request
   - Structures content into sections
   - Writes Markdown with callout syntax (:::idea, :::warning, etc.)
   - Decides which sections deserve callout highlighting (maximize usage)
   - Creates Mermaid diagram definitions (.mmd) where visual representation helps
   - Generates YAML config (title, subtitle, template, data sources)
    ↓
4. MCP call: generate_pdf(config)
   - Reporter processes everything
   - Returns PDF file path
    ↓
5. Optional: MCP/utility call to send PDF via Telegram
```

**Key principle:** The subagent should ACTIVELY use callouts and diagrams. Not sparingly — every document should have several callouts highlighting key points, and diagrams wherever a visual representation aids understanding.

## Docker Setup

### Dockerfile
```dockerfile
FROM node:20-slim

# Chrome dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 \
    libpango-1.0-0 libatspi2.0-0 libdrm2 libxshmfence1 \
    fonts-noto-color-emoji fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# TypeScript compilation
RUN npm run build

# Puppeteer config
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### docker-compose.yml (for Dokploy)
```yaml
services:
  pdf-reporter:
    build: .
    restart: unless-stopped
    volumes:
      - pdf-output:/app/output
    networks:
      - dokploy-network
    environment:
      - MCP_TRANSPORT=sse
      - MCP_PORT=3000

volumes:
  pdf-output:

networks:
  dokploy-network:
    external: true
```

### Dokploy Deployment
- Domain: `pdf-reporter.am32.oneln.ru` (for SSE transport)
- Network: `dokploy-network`
- HTTPS via Let's Encrypt (Traefik)
- Volume for output PDFs (or return as base64)

## MCP Server Implementation

### Entry point: `src/server.ts`
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface GeneratePdfInput {
  title: string;
  subtitle?: string;
  logo?: string;
  content: string;
  diagrams?: Array<{ name: string; mermaid: string }>;
  template?: string;
  options?: {
    pageSize?: string;
    toc?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  };
}

interface GeneratePdfOutput {
  path: string;
  size: string;
}

// Tool: generate_pdf
// Input: GeneratePdfInput
// Output: GeneratePdfOutput

// Tool: list_templates
// Output: string[]

// Tool: get_template_schema
// Input: { template: string }
// Output: { required: string[], optional: string[] }
```

### MCP Config for claude settings:
```json
{
  "mcpServers": {
    "pdf-reporter": {
      "type": "sse",
      "url": "https://pdf-reporter.am32.oneln.ru/sse"
    }
  }
}
```

## Generic Template Structure

```handlebars
{{!-- templates/reports/generic.hbs --}}

{{!-- Title page --}}
<div class="cover-page" style="background: #4169E1;">
  {{#if logo}}<img src="{{logo}}" class="cover-logo">{{/if}}
  <h1 class="cover-title">{{title}}</h1>
  {{#if subtitle}}<p class="cover-subtitle">{{subtitle}}</p>{{/if}}
  <p class="cover-date">{{formatDate date}}</p>
</div>

{{!-- Table of contents --}}
{{#if options.toc}}{{> toc}}{{/if}}

{{!-- Main content (rendered from Markdown) --}}
<div class="report-content">
  {{{content}}}
</div>
```

## Callout CSS Design (New colors matching plan)

```css
.callout {
  margin: 1.5em 0;
  padding: 1em 1em 1em 3.5em;
  border-left: 4px solid;
  border-radius: 0 8px 8px 0;
  position: relative;
  page-break-inside: avoid;
}

.callout-icon {
  position: absolute;
  left: 0.8em;
  top: 0.8em;
  font-size: 1.4em;
}

.callout-title {
  font-weight: 700;
  margin-bottom: 0.3em;
}

.callout-idea { border-color: #F59E0B; background: #FFFBEB; }
.callout-automation { border-color: #14B8A6; background: #F0FDFA; }
.callout-warning { border-color: #F97316; background: #FFF7ED; }
.callout-success { border-color: #22C55E; background: #F0FDF4; }
.callout-info { border-color: #3B82F6; background: #EFF6FF; }
.callout-critical { border-color: #EF4444; background: #FEF2F2; }
.callout-business { border-color: #10B981; background: #ECFDF5; }
.callout-expert { border-color: #8B5CF6; background: #F5F3FF; }
.callout-tip { border-color: #06B6D4; background: #ECFEFF; }
```

## File Structure

```
pdf-reporter-mcp/
├── plan.md                    ← THIS FILE
├── package.json
├── tsconfig.json              ← TypeScript configuration
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── server.ts              ← MCP server entry point
│   ├── pipeline.ts            ← Processing pipeline (REUSE from ~/tmp/report/)
│   ├── config-loader.ts       ← YAML config validation (REUSE)
│   ├── data-loader.ts         ← Load MD/JSON/YAML/MMD data (REUSE)
│   ├── mermaid-renderer.ts    ← Mermaid → SVG (REUSE)
│   ├── markdown-renderer.ts   ← MD → HTML (EXTEND with callout parsing)
│   ├── template-engine.ts     ← Handlebars compilation (REUSE)
│   ├── pdf-generator.ts       ← Puppeteer PDF output (REUSE)
│   └── types.ts               ← TypeScript type definitions
├── dist/                      ← Compiled JavaScript output
├── templates/
│   ├── base.hbs               ← HTML wrapper (NEW: Royal Blue cover, callout CSS)
│   ├── reports/
│   │   └── generic.hbs        ← Universal report template
│   └── partials/
│       ├── toc.hbs            ← Table of contents (REUSE)
│       ├── callout.hbs        ← Callout renderer partial (NEW)
│       └── diagram.hbs        ← Diagram wrapper (NEW)
├── styles/
│   └── report.css             ← Main CSS (ADAPT from ~/tmp/report/styles/report.css)
├── output/                    ← Generated PDFs
└── temp/                      ← Temporary Mermaid files
```

## Migration from Existing Reporter

Source: `~/tmp/report/` (CoverLaunch Report Generator)

### What to REUSE as-is (migrate to TypeScript):
- `src/pipeline.ts` — processing pipeline orchestration
- `src/config-loader.ts` — YAML config loading
- `src/data-loader.ts` — multi-format data loading
- `src/mermaid-renderer.ts` — Mermaid diagram rendering
- `src/template-engine.ts` — Handlebars compilation with helpers
- `src/pdf-generator.ts` — Puppeteer PDF generation
- `templates/partials/toc.hbs` — table of contents

### What to CREATE new:
- `src/server.ts` — MCP server wrapper
- `src/types.ts` — TypeScript type definitions
- `tsconfig.json` — TypeScript configuration
- `templates/base.hbs` — new base with Royal Blue (#4169E1) title page
- `templates/reports/generic.hbs` — universal template
- `src/markdown-renderer.ts` — EXTEND with callout syntax parsing (:::type blocks)
- Dockerfile, docker-compose.yml (with TypeScript build step)
- Tree-style bullet list CSS
- Callout section CSS and Handlebars helpers

### What to MODIFY:
- Cover page background: current dark slate (#334155) → Royal Blue (#4169E1)
- Cover page logo: make optional (currently hardcoded base64)
- Add callout parsing to markdown pipeline
- Add custom list styling
- Table header: change from gray (#f1f5f9) to Royal Blue theme

## Callout Markdown Parser Implementation

Add to `src/markdown-renderer.ts`:

```typescript
type CalloutType = 'idea' | 'automation' | 'warning' | 'success' | 'info' | 'critical' | 'business' | 'expert' | 'tip';

interface CalloutIconMap {
  [key: string]: string;
}

function parseCallouts(markdown: string): string {
  const calloutRegex = /:::(\w+)\s+(.*?)\n([\s\S]*?):::/g;

  return markdown.replace(calloutRegex, (match, type: string, title: string, body: string) => {
    const iconMap: CalloutIconMap = {
      idea: '💡',
      automation: '🤖',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️',
      critical: '🔴',
      business: '💰',
      expert: '🔍',
      tip: '💎'
    };

    const icon = iconMap[type] || 'ℹ️';
    const cleanBody = marked.parse(body.trim());

    return `
      <div class="callout callout-${type}">
        <div class="callout-icon">${icon}</div>
        <div class="callout-content">
          <div class="callout-title">${title}</div>
          <div class="callout-body">${cleanBody}</div>
        </div>
      </div>
    `;
  });
}
```

## Implementation Phases

### Phase 1: Core (MVP)
1. Initialize TypeScript project with tsconfig.json
2. Copy pipeline files from ~/tmp/report/ to pdf-reporter-mcp/src/ (migrate .mjs → .ts)
3. Create type definitions in src/types.ts
4. Create MCP server wrapper (src/server.ts)
5. Create generic.hbs template with Royal Blue title page
6. Add callout syntax parsing to markdown renderer with type annotations
7. Adapt base.hbs with new cover page and callout CSS
8. Docker setup with TypeScript build step + local testing

**Deliverables:**
- Working MCP server (stdio transport)
- Generate PDF from markdown with callouts
- Royal Blue title page
- Basic callout rendering (all 9 types)
- Full TypeScript type safety

### Phase 2: Polish
1. Tree-style bullet lists CSS
2. Table styling with Royal Blue header
3. Callout section refinement (all 9 types with proper colors)
4. Page break optimization
5. Font installation in Docker (Noto Color Emoji)
6. Mermaid diagram integration testing

**Deliverables:**
- Professional typography
- Beautiful nested lists
- Print-optimized layout
- All callout types styled correctly

### Phase 3: Deploy
1. Dokploy deployment (docker-compose on dokploy-network)
2. SSE transport configuration
3. MCP config for Claude Code (~/.claude/settings.json)
4. Integration with setup-utility skill
5. End-to-end test: user request → subagent content → MCP PDF → Telegram

**Deliverables:**
- Production deployment at pdf-reporter.am32.oneln.ru
- MCP integration working from any Claude Code session
- PDF delivery via Telegram

### Phase 4: Future
- LaTeX formula support (separate renderer, like Mermaid but for math)
- Additional templates (invoice, letter, presentation-style)
- PDF/A compliance for archival
- Watermark support
- Multi-language font support
- Custom themes (not just Royal Blue)

## Existing Reporter CSS Values (Reference)

**From `/home/alexmak/tmp/report/styles/report.css`:**

### Cover Page
```css
.cover-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  page-break-after: always;
  background: #334155; /* CHANGE TO #4169E1 */
  color: white;
  padding: 60px;
  margin: 0 -10px;
}

.cover-title {
  font-size: 32pt;
  font-weight: 700;
  margin-bottom: 16px;
  line-height: 1.2;
}

.cover-subtitle {
  font-size: 14pt;
  font-weight: 300;
  opacity: 0.85;
  margin-bottom: 48px;
}
```

### Typography
```css
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji';
  font-size: 11pt;
  line-height: 1.6;
  color: #1a1a1a;
  padding: 0 10px;
}
```

### Section Headers
```css
.section-title {
  font-size: 18pt;
  font-weight: 700;
  color: #1e293b;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 8px;
  margin-bottom: 16px;
  page-break-after: avoid;
}
```

### Code Blocks
```css
pre {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  font-size: 9pt;
  line-height: 1.5;
  margin: 12px 0;
  page-break-inside: avoid;
}

code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji';
  font-size: 9pt;
}
```

## Testing Checklist

- [ ] MCP server starts and responds to tool calls
- [ ] generate_pdf produces valid PDF from Markdown content
- [ ] Title page uses Royal Blue background (#4169E1) with project name
- [ ] Callout sections render with correct icons and colors (all 9 types)
- [ ] Mermaid diagrams render to SVG and appear in PDF
- [ ] Nested bullet lists show tree-style connectors
- [ ] Tables have proper styling with Royal Blue themed header
- [ ] Page breaks don't split sections awkwardly
- [ ] Docker container runs with all dependencies (Chrome, fonts)
- [ ] Dokploy deployment accessible via SSE
- [ ] Integration with setup-utility skill works end-to-end
- [ ] PDF delivery via Telegram MCP tool

## MCP Tool Schemas

### generate_pdf
```json
{
  "name": "generate_pdf",
  "description": "Generate a professional PDF document from structured content",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Document title (appears on cover page)"
      },
      "subtitle": {
        "type": "string",
        "description": "Document subtitle (optional, appears below title)"
      },
      "logo": {
        "type": "string",
        "description": "Path to logo image file or data URI (optional)"
      },
      "content": {
        "type": "string",
        "description": "Document content in Markdown format with callout syntax (:::type Title\\nContent\\n:::)"
      },
      "diagrams": {
        "type": "array",
        "description": "Mermaid diagram definitions (optional)",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "mermaid": { "type": "string" }
          }
        }
      },
      "template": {
        "type": "string",
        "description": "Template name (default: 'generic')"
      },
      "options": {
        "type": "object",
        "description": "PDF generation options",
        "properties": {
          "pageSize": { "type": "string", "default": "A4" },
          "toc": { "type": "boolean", "default": false },
          "headerTemplate": { "type": "string" },
          "footerTemplate": { "type": "string" }
        }
      }
    },
    "required": ["title", "content"]
  }
}
```

### list_templates
```json
{
  "name": "list_templates",
  "description": "List available PDF report templates",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

### get_template_schema
```json
{
  "name": "get_template_schema",
  "description": "Get required and optional fields for a specific template",
  "inputSchema": {
    "type": "object",
    "properties": {
      "template": {
        "type": "string",
        "description": "Template name"
      }
    },
    "required": ["template"]
  }
}
```

## Content Subagent Prompt Template

```
You are a content writer for professional PDF reports. Generate structured markdown content with rich formatting.

USER REQUEST: {user_request}

OUTPUT REQUIREMENTS:

1. Structure content with clear sections (## headings)

2. Use callout blocks generously to highlight key points:
   :::idea Title
   Innovative insights or novel approaches
   :::

   :::automation Automation Opportunity
   Where AI or automation can help
   :::

   :::warning Important Caveat
   Risks, limitations, or cautions
   :::

   :::business Business Value
   ROI, cost savings, business impact
   :::

   :::tip Pro Tip
   Best practices or expert advice
   :::

3. Add Mermaid diagrams where visual representation helps understanding:
   - Flowcharts for processes
   - Sequence diagrams for interactions
   - Gantt charts for timelines
   - Pie charts for distributions

4. Use rich markdown: **bold**, *italic*, lists, tables, code blocks

5. Output JSON:
{
  "title": "Document Title",
  "subtitle": "Brief description (1-2 lines)",
  "content": "Full markdown content with callouts",
  "diagrams": [
    {
      "name": "process-flow",
      "mermaid": "graph TD\\n  A[Start] --> B[Process]"
    }
  ]
}

REMEMBER: Use callouts frequently — they make documents engaging and highlight important information.
```

## Key Design Decisions

1. **Royal Blue (#4169E1) as theme color** — Modern, professional, distinctive. Applied to title page, section headers, table headers, bullet markers.

2. **Callout-first content strategy** — Encourage heavy use of callouts to break up text and highlight key information. Not an afterthought — a primary content pattern.

3. **Mermaid diagrams as first-class citizens** — Not just "if needed" but actively encouraged. Visual representations improve comprehension.

4. **Tree-style lists** — More sophisticated than default bullets. Shows hierarchy clearly with visual connectors.

5. **Print-optimized from the start** — Page breaks, widows/orphans prevention, proper margins. Not "web page to PDF" but "designed for PDF."

6. **Reuse proven pipeline** — Don't reinvent the wheel. The existing reporter at ~/tmp/report/ has a solid architecture. Adapt, don't rebuild.

7. **MCP as deployment pattern** — Isolated service accessible by any agent. Not coupled to setup repo. Production-grade from day one.

8. **Subagent-driven content** — Main agent delegates to content subagent. Keeps context clean, allows specialized prompting for document generation.

## Success Criteria

**Functional:**
- Generate multi-page PDF from markdown in <30 seconds
- Support all 9 callout types with proper styling
- Render Mermaid diagrams to print-quality SVG
- Optional logo, subtitle, TOC
- Configurable page size and margins

**Quality:**
- Professional typography (no awkward spacing, proper line heights)
- Correct page breaks (no orphaned headings)
- Print-quality output (300 DPI equivalent)
- Emoji support in titles and callouts
- Consistent styling across all sections

**Operational:**
- Docker container runs reliably
- Deployed to Dokploy with auto-restart
- Accessible via MCP SSE from any Claude Code session
- Error handling and graceful degradation (failed diagram → error message, not crash)
- Fast response time (<30s for typical 10-page document)

---

**NEXT STEPS:**
1. Initialize TypeScript project (package.json with TypeScript dependencies, tsconfig.json)
2. Create project directory structure
3. Copy reusable files from ~/tmp/report/ and migrate to TypeScript
4. Create type definitions (src/types.ts)
5. Implement MCP server wrapper with typed interfaces
6. Create new templates with Royal Blue theme
7. Extend markdown renderer with callout parsing (typed)
8. Docker containerization with TypeScript build step
9. Local testing
10. Dokploy deployment
11. Integration with setup-utility skill

This plan is the complete specification. Implementation can begin immediately.
