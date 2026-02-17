import { renderDiagram, renderContent, generatePdfFromHtml } from '../src/pipeline.js';

async function main() {
  console.log('Step 1: Rendering diagrams...');

  // Diagram 1: Architecture
  const archDiagram = await renderDiagram({
    name: 'architecture',
    mermaid: `graph TD
    A[MCP Client] -->|render_diagram| B[Mermaid Renderer]
    A -->|render_content| C[Markdown Renderer]
    A -->|generate_pdf| D[PDF Generator]
    B --> E[SVG Output]
    C --> F[HTML Output]
    E --> C
    F --> D
    D --> G[PDF File]

    style A fill:#4169E1,color:#fff
    style G fill:#22C55E,color:#fff`
  });
  console.log(`  ✓ Architecture diagram: ${archDiagram.svg.length} bytes SVG`);

  // Diagram 2: Pipeline flow
  const flowDiagram = await renderDiagram({
    name: 'pipeline',
    mermaid: `sequenceDiagram
    participant Client
    participant MCP as MCP Server
    participant Mermaid
    participant Marked
    participant HBS as Handlebars
    participant Chrome as Puppeteer

    Client->>MCP: render_diagram(mermaid)
    MCP->>Mermaid: mmdc CLI
    Mermaid-->>MCP: SVG
    MCP-->>Client: { name, svg }

    Client->>MCP: render_content(md, diagrams)
    MCP->>Marked: parse(markdown)
    Marked-->>MCP: HTML
    MCP-->>Client: { html }

    Client->>MCP: generate_pdf(title, html)
    MCP->>HBS: compile(template)
    HBS-->>MCP: Full HTML
    MCP->>Chrome: page.pdf()
    Chrome-->>MCP: PDF buffer
    MCP-->>Client: { path, size }`
  });
  console.log(`  ✓ Pipeline diagram: ${flowDiagram.svg.length} bytes SVG`);

  // Diagram 3: Pie chart
  const pieDiagram = await renderDiagram({
    name: 'stats',
    mermaid: `pie title Code Distribution
    "Source Code" : 1230
    "Tests" : 1650
    "CSS & Templates" : 520
    "Documentation" : 400`
  });
  console.log(`  ✓ Stats diagram: ${pieDiagram.svg.length} bytes SVG`);

  console.log('\nStep 2: Rendering content...');

  const content = await renderContent({
    markdown: `# PDF Reporter MCP — Overview

## Architecture

The system is built as a modular MCP server with three main tools that can be composed together:

{{diagram:architecture}}

## How It Works

The pipeline follows a clear sequence of operations:

{{diagram:pipeline}}

## Key Features

### Callout Blocks Showcase

The system supports 9 types of callout blocks for rich document formatting:

:::idea Creative Insight
Every great report starts with a clear structure. Use **headings** for navigation, **callouts** for emphasis, and **diagrams** for visualization. The combination creates documents that are both informative and visually engaging.
:::

:::automation Automation Opportunity
This entire report was generated programmatically through MCP tools. The workflow can be integrated into any CI/CD pipeline:
1. Collect data from APIs
2. Render diagrams from metrics
3. Generate PDF automatically
4. Distribute via email or Slack
:::

:::warning Browser Dependency
Puppeteer requires Chrome/Chromium to be installed. In Docker, the Dockerfile handles this automatically. Locally, Puppeteer downloads Chrome on \`npm install\`.
:::

:::success All Tests Passing
The project achieves **77 tests** across 7 test suites with 100% pass rate. All tests run fully offline using mocked dependencies — no external services required.
:::

:::info Architecture Decision
The MCP server exposes three granular tools instead of one monolithic function. This allows AI assistants to build reports **incrementally** — rendering diagrams first, then composing content, and finally generating the PDF.
:::

:::critical Security Consideration
User-provided content is rendered through Handlebars with HTML escaping enabled by default. However, the \`content\` field accepts raw HTML — always sanitize untrusted input before passing it to \`generate_pdf\`.
:::

:::business Return on Investment
A single MCP server replaces custom PDF generation code in every project. **One deployment** serves unlimited clients — reducing development time from days to minutes per new report type.
:::

:::expert Technical Deep Dive
The callout parser uses a two-phase approach: first, fenced code blocks are identified and protected from processing. Then, \`:::type\` blocks are extracted via regex, their body content is recursively rendered through \`marked\`, and the result is wrapped in styled HTML divs with inline CSS for print reliability.
:::

:::tip Best Practice
Use \`render_diagram\` separately to pre-render each diagram, then pass the SVG results to \`render_content\`. This gives you full control over the rendering pipeline and makes debugging easier.
:::

### Code Distribution

{{diagram:stats}}

### Code Highlighting

The system supports syntax highlighting in code blocks:

\`\`\`typescript
// Example: Using the MCP tools
const diagram = await renderDiagram({
  name: 'flow',
  mermaid: 'graph TD; A-->B',
});

const content = await renderContent({
  markdown: '# Report\\n{{diagram:flow}}',
  diagrams: [diagram],
});

const pdf = await generatePdfFromHtml({
  title: 'My Report',
  content: content.html,
});
\`\`\`

## Technical Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 20 | Server platform |
| Language | TypeScript (strict) | Type safety |
| PDF Engine | Puppeteer | Chrome-based PDF generation |
| Diagrams | Mermaid CLI | Diagram rendering |
| Templates | Handlebars | HTML templating |
| Markdown | marked + highlight.js | Content rendering |
| Protocol | MCP SDK | Tool interface |
| Tests | Vitest | 77 tests, all offline |

## Summary

PDF Reporter MCP transforms markdown content into professional PDF documents with:

- **Royal Blue themed** cover pages and table headers
- **9 callout types** for structured information blocks
- **Mermaid diagrams** rendered to crisp SVG
- **Syntax-highlighted** code blocks
- **Configurable themes** via environment variables
- **Docker-ready** deployment with GitHub Actions CI
`,
    diagrams: [archDiagram, flowDiagram, pieDiagram],
  });
  console.log(`  ✓ Content rendered: ${content.html.length} bytes HTML`);

  console.log('\nStep 3: Generating PDF...');

  const result = await generatePdfFromHtml({
    title: 'PDF Reporter MCP',
    subtitle: 'Technical Overview & Demo Report',
    content: content.html,
    options: {
      toc: true,
      pageSize: 'A4',
    },
  });

  console.log(`\n✅ PDF generated!`);
  console.log(`   Path: ${result.path}`);
  console.log(`   Size: ${result.size}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
