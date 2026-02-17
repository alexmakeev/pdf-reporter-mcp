# PDF Reporter MCP

MCP server for generating professional PDF documents from Markdown content with callout syntax, Mermaid diagrams, and styled templates.

## Features

- **Markdown to PDF** — Convert Markdown content with custom callout blocks to styled PDF documents
- **Mermaid Diagrams** — Inline Mermaid diagram rendering to SVG with placeholder replacement
- **Callout Blocks** — 9 callout types with custom styling using `:::type Title` syntax
- **Cover Pages** — Professional cover page with title, subtitle, and optional logo
- **Table of Contents** — Auto-generated TOC with heading anchors
- **PDF Options** — Configurable page size, margins, headers, and footers
- **MCP Protocol** — Standard MCP server with stdio transport

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

Server runs on stdio by default. Compatible with Claude Desktop via stdio transport.

### Docker

```bash
docker build -t pdf-reporter-mcp .
docker compose up
```

## MCP Tools

### 1. render_diagram

Render a single Mermaid diagram to SVG.

**Input Parameters:**
- `mermaid` (required, string) — Mermaid diagram definition

**Output:**
```json
{
  "svg": "<svg>...</svg>"
}
```

### 2. render_content

Render Markdown content with callouts and diagram placeholders to HTML.

**Input Parameters:**
- `content` (required, string) — Markdown content with optional callout syntax
- `diagrams` (optional, object) — Pre-rendered SVG diagrams: `{ [name]: string }`

**Output:**
```json
{
  "html": "<article>...</article>"
}
```

### 3. generate_pdf

Generate a PDF document from HTML content.

**Input Parameters:**
- `title` (required, string) — Document title for cover page
- `html` (required, string) — Rendered HTML content
- `subtitle` (optional, string) — Document subtitle
- `logo` (optional, string) — Logo as data URI or file path
- `template` (optional, string, default: `generic`) — Template name
- `options` (optional, object) — PDF generation options:
  - `pageSize` (string, default: `A4`) — Page size (e.g. `A4`, `Letter`)
  - `toc` (boolean, default: `false`) — Generate table of contents
  - `headerTemplate` (string or false) — Custom header template HTML
  - `footerTemplate` (string or false) — Custom footer template HTML
  - `margins` (object) — Page margins with `top`, `bottom`, `left`, `right` (e.g. `17mm`)

**Output:**
```json
{
  "path": "/tmp/pdf-reporter-output/document-title.pdf",
  "size": "2.4 MB",
  "pages": 15
}
```

### 4. list_templates

List available report templates.

**Output:**
```json
{
  "templates": [
    {
      "name": "generic",
      "description": "Universal report template with cover page, optional TOC, and markdown content"
    }
  ]
}
```

### 5. get_template_schema

Get the input schema for a specific template.

**Input:**
- `template` (required, string) — Template name

**Output:**
```json
{
  "required": ["title", "html"],
  "optional": ["subtitle", "logo", "options"]
}
```

## Theme Configuration

Customize document appearance via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `THEME_PRIMARY_COLOR` | `#4169E1` | Accent color for headings, callouts, and UI elements |
| `THEME_COVER_COLOR` | Same as primary | Cover page background color |

**Example:**
```bash
export THEME_PRIMARY_COLOR="#E81E63"
export THEME_COVER_COLOR="#880E4F"
npm run dev
```

Colors are applied to:
- Cover page background
- Heading text
- Callout borders and backgrounds
- Links and accents

## Callout Syntax

```markdown
:::info Important Note
This is an informational callout block.
Supports **markdown** inside.
:::

:::warning Caution
Be careful with this operation.
:::

:::success Achievement Unlocked
All systems operational.
:::
```

### Supported Callout Types

| Type | Emoji | Use Case |
|------|-------|----------|
| `info` | ℹ️ | General information |
| `idea` | 💡 | New ideas and suggestions |
| `automation` | 🤖 | Automation features |
| `warning` | ⚠️ | Warnings and cautions |
| `success` | ✅ | Successful outcomes |
| `critical` | 🔴 | Critical alerts |
| `business` | 💰 | Business insights |
| `expert` | 🔍 | Expert recommendations |
| `tip` | 💎 | Tips and best practices |

## Architecture

**3-step workflow:**

```
Step 1: render_diagram (for each diagram)
  Mermaid definition → SVG
  ↓
Step 2: render_content
  Markdown + callouts + SVG references → HTML
  ↓
Step 3: generate_pdf
  Title + HTML → PDF file
  ↓
output: { path, size, pages }
```

**Full pipeline (internal to generate_pdf):**
1. Resolve Options — Apply defaults to PDF options
2. Create Metadata — Extract title, subtitle, logo, date
3. Compile Template — Handlebars with context
4. Generate PDF — Puppeteer headless Chrome → PDF file

## Development

See [docs/dev.md](docs/dev.md) for development setup, testing, and architecture details.

## Production Deployment

See [docs/prod.md](docs/prod.md) for Docker build, deployment, and configuration.

## License

MIT
