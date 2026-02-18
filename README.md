[![CI](https://github.com/alexmakeev/pdf-reporter-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/alexmakeev/pdf-reporter-mcp/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-164%20passed-brightgreen)]()
[![Mutation Score](https://img.shields.io/badge/mutation%20score-94%25-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)

# PDF Reporter MCP

Multi-purpose MCP server for generating SVG diagrams and PDF documents. Render Mermaid diagrams to SVG, compose Markdown content with callout blocks, and produce styled PDF reports — all through standard MCP tools.

## Features

- **Mermaid to SVG** — Render Mermaid diagrams to clean SVG via dedicated MCP tool
- **Markdown to PDF** — Convert Markdown content with custom callout blocks to styled PDF documents
- **Callout Blocks** — 9 callout types (idea, automation, warning, success, info, critical, business, expert, tip) using `:::type Title` syntax
- **Pastel Theme** — Professional styling with configurable pastel color palette
- **Harmonious Diagrams** — Pastel fills with tonal text and borders for visual consistency
- **MCP Protocol** — Standard MCP server with stdio and SSE transports

## Quick Start

### Installation

```bash
git clone https://github.com/alexmakeev/pdf-reporter-mcp.git
cd pdf-reporter-mcp
npm install
```

### Usage

```bash
# Development
npm run dev

# Production
npm run build && npm start

# Docker
docker compose up
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "pdf-reporter": {
      "command": "node",
      "args": ["/path/to/pdf-reporter-mcp/dist/server.js"]
    }
  }
}
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

## Workflow

The typical workflow is three steps:

```
1. render_diagram  →  Mermaid source  →  SVG string
2. render_content  →  Markdown + SVGs  →  HTML
3. generate_pdf    →  HTML + metadata  →  PDF file
```

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

## Example

See the [demo report](examples/demo-report.pdf) for a complete example featuring all capabilities.

Generated with [examples/generate-demo.ts](examples/generate-demo.ts).

## Theme Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `THEME_PRIMARY_COLOR` | `#4169E1` | Primary accent color (Royal Blue) |
| `THEME_COVER_COLOR` | same as primary | Cover page accent color |

The server auto-generates a pastel palette from the primary color for backgrounds, table headers, and cover elements. All text remains dark for readability.

**Example:**
```bash
export THEME_PRIMARY_COLOR="#E81E63"
export THEME_COVER_COLOR="#880E4F"
npm run dev
```

## Architecture

```
MCP Input
  → Mermaid Renderer (mmdc CLI → SVG)
  → Callout Parser (:::syntax → HTML)
  → Markdown Renderer (marked + highlight.js)
  → Template Engine (Handlebars)
  → PDF Generator (Puppeteer)
```

## Development

```bash
npm run dev          # Start dev server
npm test             # Run 164 tests
npm run test:watch   # Watch mode
npm run test:mutation # Mutation testing (Stryker)
npm run build        # TypeScript compilation
```

See [docs/dev.md](docs/dev.md) for the full developer guide.

## Deployment

See [docs/prod.md](docs/prod.md) for Docker and Dokploy deployment instructions.

## Testing

- **164 unit tests** across 8 test suites (vitest)
- **94.21% mutation score** via Stryker (minimum 89% per module)
- All tests run offline with mocked dependencies

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+, TypeScript (strict) |
| PDF | Puppeteer (headless Chrome) |
| Diagrams | @mermaid-js/mermaid-cli |
| Templates | Handlebars |
| Markdown | marked + highlight.js |
| MCP | @modelcontextprotocol/sdk |
| Tests | vitest + Stryker |

## License

[MIT](LICENSE) © Alexander Makeev
