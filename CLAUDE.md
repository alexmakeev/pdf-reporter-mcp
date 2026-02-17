# PDF Reporter MCP — Project Instructions

## Overview
MCP server that generates PDF documents from Markdown content with callout syntax, Mermaid diagrams, and professional styling. TypeScript, ESM, strict mode.

## Tech Stack
- **Runtime:** Node.js 20+, TypeScript, ESM (NodeNext)
- **PDF:** Puppeteer 23.11.1 (headless Chrome)
- **Diagrams:** @mermaid-js/mermaid-cli 11.12.0 (mmdc)
- **Templates:** Handlebars 4.7.8
- **Markdown:** marked 15.0.4 + highlight.js 11.11.1
- **MCP:** @modelcontextprotocol/sdk 1.0.4
- **Tests:** vitest 2.1.8
- **Build:** TypeScript 5.7.2 + tsx 4.19.2

## Project Structure
```
src/
  server.ts              — MCP server entry point, tool definitions
  pipeline.ts            — Main PDF generation pipeline orchestrator
  types.ts               — All TypeScript types, constants, error classes
  markdown-renderer.ts   — Markdown + callout parsing, highlight.js
  mermaid-renderer.ts    — Mermaid diagram rendering to SVG via mmdc
  template-engine.ts     — Handlebars template compilation
  pdf-generator.ts       — Puppeteer PDF generation
  config-loader.ts       — Configuration resolution
  __tests__/             — Vitest unit tests
templates/
  base.hbs               — HTML wrapper template with embedded styles
  reports/generic.hbs    — Generic report template
  partials/              — Handlebars partials (toc, cover, etc)
styles/
  report.css             — PDF document styles
Dockerfile               — Multi-stage Docker build (builder + runtime)
docker-compose.yml       — Docker Compose for Dokploy deployment
```

## Commands
- `npm run build` — TypeScript compilation to dist/
- `npm run dev` — Development with tsx live reload
- `npm test` — Run tests once
- `npm run test:watch` — Vitest watch mode
- `npm run test:coverage` — Coverage report
- `npm start` — Production server from dist/

## Environment Variables
- `NODE_ENV` — `development` (for logging)
- `OUTPUT_DIR` — `/tmp/pdf-reporter-output`
- `TEMP_DIR` — system temp dir (auto-cleaned)
- `PORT` — `3000` (for SSE in Docker)
- `TRANSPORT` — `stdio` (default, change to `sse` for HTTP)
- `PUPPETEER_EXECUTABLE_PATH` — auto-detected (set to override)
- `THEME_PRIMARY_COLOR` — Accent color (default: `#4169E1`)
- `THEME_COVER_COLOR` — Cover page background (default: same as primary)

## Conventions
- **Types:** All types in `src/types.ts` — single source of truth
- **Errors:** PdfReporterError class with error codes (VALIDATION_ERROR, TEMPLATE_NOT_FOUND, etc)
- **Typing:** No `any` types — strict TypeScript throughout
- **Imports:** ESM with .js extensions in output
- **Tests:** Must run offline — all external calls mocked
- **Callouts:** 9 types with emoji and color definitions in types.ts

## Key Design Decisions
- **Content as strings:** Input is Markdown via MCP, no file I/O
- **Two-stage rendering:** Callouts (:::type) → HTML first, then markdown
- **Diagram injection:** Diagrams rendered to SVG, then injected via {{diagram:name}} placeholders
- **Single template:** Generic template covers all use cases
- **Error handling:** PdfReporterError propagated as MCP tool errors
- **Temp cleanup:** Pipeline creates unique temp dirs, auto-cleanup on success/failure
- **Output location:** PDFs written to `/tmp/pdf-reporter-output` (configurable)

## Testing
- Uses vitest for unit tests
- All Puppeteer and mmdc calls must be mocked in tests
- Tests check schema validation, callout rendering, error handling
- Coverage target: >80%
