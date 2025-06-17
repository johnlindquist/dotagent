# agentconfig

Universal AI agent configuration parser and converter. Maintain a single source of truth for AI coding assistant rules across VS Code Copilot, Cursor, Cline, Windsurf, Zed, OpenAI Codex, and more.

## Features

- 🔄 **Import** rules from any supported IDE/tool format
- 📝 **Convert** to a unified `.agent.md` format
- 🚀 **Export** back to all supported formats
- 🛠️ **CLI tool** for easy automation
- 📦 **TypeScript API** for programmatic use
- 🎨 **Color-coded output** for better readability
- 👁️ **Dry-run mode** to preview operations without changes
- 💡 **Smart error messages** with actionable hints

## Supported Formats

| Tool/IDE | Rule File | Format |
|----------|-----------|---------|
| VS Code (Copilot) | `.github/copilot-instructions.md` | Plain Markdown |
| Cursor | `.cursor/rules/*.mdc` | Markdown with YAML frontmatter |
| Cline | `.clinerules` or `.clinerules/*.md` | Plain Markdown |
| Windsurf | `.windsurfrules` | Plain Markdown |
| Zed | `.rules` | Plain Markdown |
| OpenAI Codex | `AGENTS.md` | Plain Markdown |
| Aider | `CONVENTIONS.md` | Plain Markdown |

## Installation

```bash
npm install -g agentconfig
# or
pnpm add -g agentconfig
```

## CLI Usage

### Import all rules from a repository

```bash
# Import from current directory
agentconfig import .

# Import from specific path
agentconfig import /path/to/repo

# Specify output file
agentconfig import . -o my-rules.agent.md

# Preview without making changes
agentconfig import . --dry-run
```

### Export `.agent.md` to all formats

```bash
# Export to current directory
agentconfig export .agent.md

# Export to specific directory
agentconfig export .agent.md -o /path/to/repo
```

### Convert a specific file

```bash
# Auto-detect format
agentconfig convert .github/copilot-instructions.md

# Specify format explicitly
agentconfig convert my-rules.md -f cursor -o .agent.md
```

## Unified Format

The `.agent.md` format uses HTML directives to embed metadata:

```markdown
<!-- @meta
id: core-style
alwaysApply: true
priority: high
-->

## Core Style Guidelines

1. Use **Bazel** for Java builds
2. JavaScript: double quotes, tabs for indentation
3. All async functions must handle errors

<!-- @pagebreak -->

<!-- @meta
id: api-safety
scope: src/api/**
manual: true
-->

## API Safety Rules

- Never log PII
- Validate all inputs with zod
- Rate limit all endpoints
```

## Programmatic Usage

```typescript
import { 
  importAll, 
  parseAgentMarkdown, 
  toAgentMarkdown,
  exportAll 
} from 'agentconfig'

// Import all rules from a repository
const { results, errors } = await importAll('/path/to/repo')

// Parse agent markdown
const rules = parseAgentMarkdown(agentMarkdownContent)

// Convert rules to agent markdown
const markdown = toAgentMarkdown(rules)

// Export to all formats
exportAll(rules, '/path/to/repo')
```

## API Reference

### Types

```typescript
interface RuleBlock {
  metadata: RuleMetadata
  content: string
  position?: Position
}

interface RuleMetadata {
  id: string
  alwaysApply?: boolean
  scope?: string | string[]
  triggers?: string[]
  manual?: boolean
  priority?: 'high' | 'medium' | 'low'
  description?: string
  [key: string]: unknown
}
```

### Parser Functions

- `parseAgentMarkdown(markdown: string): RuleBlock[]` - Parse HTML-directive format
- `parseFenceEncodedMarkdown(markdown: string): RuleBlock[]` - Parse fence-encoded format

### Import Functions

- `importAll(repoPath: string): Promise<ImportResults>` - Auto-detect and import all formats
- `importCopilot(filePath: string): ImportResult` - Import VS Code Copilot format
- `importCursor(rulesDir: string): ImportResult` - Import Cursor MDC files
- `importCline(rulesPath: string): ImportResult` - Import Cline rules
- `importWindsurf(filePath: string): ImportResult` - Import Windsurf rules
- `importZed(filePath: string): ImportResult` - Import Zed rules
- `importCodex(filePath: string): ImportResult` - Import OpenAI Codex format

### Export Functions

- `toAgentMarkdown(rules: RuleBlock[]): string` - Convert to unified format
- `exportAll(rules: RuleBlock[], repoPath: string): void` - Export to all formats
- `exportToCopilot(rules: RuleBlock[], outputPath: string): void`
- `exportToCursor(rules: RuleBlock[], outputDir: string): void`
- `exportToCline(rules: RuleBlock[], outputPath: string): void`
- `exportToWindsurf(rules: RuleBlock[], outputPath: string): void`
- `exportToZed(rules: RuleBlock[], outputPath: string): void`
- `exportToCodex(rules: RuleBlock[], outputPath: string): void`

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Roadmap

- [ ] Support for more IDE formats
- [ ] Web-based converter UI
- [ ] GitHub Action for automatic sync
- [ ] Support for team rule templates
- [ ] Validation and linting of rules
- [ ] Rule inheritance and composition