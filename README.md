# dotagent

Multi-file AI agent configuration manager with .agent directory support. Maintain a single source of truth for AI coding assistant rules across Claude Code, VS Code Copilot, Cursor, Cline, Windsurf, Zed, and more.

## Features

- 🔄 **Import** rules from any supported IDE/tool format
- 📝 **Convert** to a unified `.agent/` directory structure
- 🚀 **Export** back to all supported formats
- 📁 **Nested folders** support for better organization
- 🛠️ **CLI tool** for easy automation
- 📦 **TypeScript API** for programmatic use
- 🎨 **Color-coded output** for better readability
- 👁️ **Dry-run mode** to preview operations without changes
- 💡 **Smart error messages** with actionable hints

## Supported Formats

| Tool/IDE | Rule File | Format |
|----------|-----------|---------|
| Agent (dotagent) | `.agent/**/*.md` | Markdown with YAML frontmatter |
| Claude Code | `CLAUDE.md` | Plain Markdown |
| VS Code (Copilot) | `.github/copilot-instructions.md` | Plain Markdown |
| Cursor | `.cursor/rules/*.mdc`, `.cursor/rules/*.md` | Markdown with YAML frontmatter |
| Cline | `.clinerules` or `.clinerules/*.md` | Plain Markdown |
| Windsurf | `.windsurfrules` | Plain Markdown |
| Zed | `.rules` | Plain Markdown |
| OpenAI Codex | `AGENTS.md` | Plain Markdown |
| Aider | `CONVENTIONS.md` | Plain Markdown |
| Qodo | `best_practices.md` | Plain Markdown |

## Installation

```bash
npm install -g dotagent
# or
pnpm add -g dotagent
```

## CLI Usage

### Import all rules from a repository

```bash
# Import from current directory (creates .agent/ directory)
agentconfig import .

# Import from specific path
agentconfig import /path/to/repo

# Preview without making changes
agentconfig import . --dry-run
```

### Export `.agent/` directory to all formats

```bash
# Export from current directory's .agent/
agentconfig export .

# Export to specific directory
agentconfig export . -o /path/to/repo

# Include private rules in export
agentconfig export --include-private
```

### Convert a specific file

```bash
# Auto-detect format
agentconfig convert .github/copilot-instructions.md

# Specify format explicitly
agentconfig convert my-rules.md -f cursor
```

## Unified Format

The `.agent/` directory contains `.md` files (Markdown with YAML frontmatter) to organize rules, supporting nested folders:

```markdown
---
id: core-style
title: Core Style Guidelines
alwaysApply: true
priority: high
---

## Core Style Guidelines

1. Use **Bazel** for Java builds
2. JavaScript: double quotes, tabs for indentation
3. All async functions must handle errors
```

And another file `.agent/api-safety.md`:

```markdown
---
id: api-safety
title: API Safety Rules
scope: src/api/**
manual: true
---

## API Safety Rules

- Never log PII
- Validate all inputs with zod
- Rate limit all endpoints
```

Nested folders are supported - for example `.agent/frontend/components.md`:

```markdown
---
id: frontend/components
title: Component Guidelines
scope: src/components/**
---

## Component Guidelines

- Use functional components with hooks
- Follow atomic design principles
- Include unit tests for all components
```

## Private Rules

DotAgent supports private/local rules that are automatically excluded from exports and version control. This is useful for:
- Personal preferences that shouldn't be shared with the team
- Client-specific requirements  
- Temporary experimental rules
- Sensitive information or internal processes

### Naming Convention

Private rules are identified by:
1. **Filename suffix**: `*.local.md` (e.g., `api-keys.local.md`)
2. **Directory**: Files in `/private/` subdirectories
3. **Frontmatter**: `private: true` in YAML frontmatter

### Examples

```markdown
<!-- .agent/team-rules.md (PUBLIC) -->
---
id: team-rules
---
# Team Standards
Shared team guidelines
```

```markdown
<!-- .agent/my-preferences.local.md (PRIVATE) -->
---
id: my-preferences
---
# My Personal Preferences
These won't be exported
```

```markdown
<!-- .agent/private/client-specific.md (PRIVATE) -->
---
id: client-rules
---
# Client-Specific Rules
Confidential requirements
```

### Private Rules in Other Formats

| Format | Public File | Private File |
|--------|-------------|---------------|
| Copilot | `.github/copilot-instructions.md` | `.github/copilot-instructions.local.md` |
| Cursor | `.cursor/rules/*.mdc` | `.cursor/rules/*.local.mdc` |
| Cline | `.clinerules` | `.clinerules.local` |
| Windsurf | `.windsurfrules` | `.windsurfrules.local` |
| Zed | `.rules` | `.rules.local` |
| Claude | `CLAUDE.md` | `CLAUDE.local.md` |

### CLI Options

```bash
# Export including private rules
dotagent export --include-private

# Import but skip private rules
dotagent import . --skip-private
```

### Automatic .gitignore

When you run `dotagent export`, it automatically updates your `.gitignore` with patterns for private files:

```gitignore
# Added by dotagent: ignore private AI rule files
.agent/**/*.local.md
.agent/private/**
.github/copilot-instructions.local.md
.cursor/rules/**/*.local.mdc
.cursor/rules-private/**
.clinerules.local
.clinerules/private/**
.windsurfrules.local
.rules.local
AGENTS.local.md
CONVENTIONS.local.md
CLAUDE.local.md
```

## Programmatic Usage

```typescript
import { 
  importAll, 
  importAgent,
  exportToAgent,
  exportAll 
} from 'dotagent'

// Import all rules from a repository
const { results, errors } = await importAll('/path/to/repo')

// Import from .agent directory
const { rules } = await importAgent('/path/to/repo/.agent')

// Export to .agent directory
await exportToAgent(rules, '/path/to/repo')

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
- `importQodo(filePath: string): ImportResult` - Import Qodo best practices

### Export Functions

- `toAgentMarkdown(rules: RuleBlock[]): string` - Convert to unified format
- `exportAll(rules: RuleBlock[], repoPath: string): void` - Export to all formats
- `exportToCopilot(rules: RuleBlock[], outputPath: string): void`
- `exportToCursor(rules: RuleBlock[], outputDir: string): void`
- `exportToCline(rules: RuleBlock[], outputPath: string): void`
- `exportToWindsurf(rules: RuleBlock[], outputPath: string): void`
- `exportToZed(rules: RuleBlock[], outputPath: string): void`
- `exportToCodex(rules: RuleBlock[], outputPath: string): void`
- `exportToQodo(rules: RuleBlock[], outputPath: string): void` - Export to Qodo best practices

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