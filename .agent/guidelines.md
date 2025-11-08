---
alwaysApply: true
---
## Project Overview

dotagent is a multi-file AI agent configuration manager that maintains a single source of truth for AI coding assistant rules across multiple IDEs and tools (including VS Code Copilot, Cursor, Claude Code, OpenCode, Windsurf, and more). It converts between a unified `.agent/` directory format and tool-specific formats, supporting import/export operations, nested folders, private rules, and both CLI and TypeScript API usage.

## Package Manager

This project uses **pnpm** for dependency management.

## Available Scripts

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Development mode (watch)
pnpm dev

# Run tests (recommended for AI agents - non-interactive)
pnpm test:ci

# Type checking
pnpm typecheck
```
