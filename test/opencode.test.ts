import { describe, it, expect } from 'vitest'
import { importOpenCode, exportToOpenCode } from '../src/index.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src/types.js'

describe('OpenCode format', () => {
  it('should import AGENTS.md file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-test-'))
    const agentsPath = join(tempDir, 'AGENTS.md')
    
    const content = `# Project Context

This project is a React application with TypeScript.

## Coding Standards

- Use functional components with hooks
- Follow ESLint rules strictly
- All components must have tests

## Common Commands

\`\`\`bash
npm run dev      # Start development server
npm run test     # Run tests
npm run build    # Build for production
\`\`\`

## Architecture Notes

The app uses Redux for state management and React Router for navigation.`

    writeFileSync(agentsPath, content, 'utf8')

    try {
      const result = importOpenCode(agentsPath)

      expect(result.format).toBe('opencode')
      expect(result.filePath).toBe(agentsPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('opencode-agents')
      expect(result.rules[0].metadata.alwaysApply).toBe(true)
      expect(result.rules[0].content).toContain('Project Context')
      expect(result.rules[0].content).toContain('npm run dev')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export to AGENTS.md format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-export-'))
    const agentsPath = join(tempDir, 'AGENTS.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'project-setup',
          description: 'Project Setup Instructions',
          alwaysApply: true
        },
        content: `## Environment Setup

Use Node.js 20+ and pnpm for package management.

### Required Tools
- pnpm
- TypeScript 5+
- ESLint`
      },
      {
        metadata: {
          id: 'code-style',
          description: 'Code Style Guidelines'
        },
        content: `## Formatting

- 2 space indentation
- Single quotes for strings
- No semicolons`
      }
    ]

    try {
      exportToOpenCode(rules, agentsPath)

      const exported = readFileSync(agentsPath, 'utf8')
      
      // Should include headers from descriptions
      expect(exported).toContain('# Project Setup Instructions')
      expect(exported).toContain('# Code Style Guidelines')
      
      // Should include content
      expect(exported).toContain('Use Node.js 20+ and pnpm')
      expect(exported).toContain('2 space indentation')
      
      // Should separate rules with double newlines
      expect(exported.split('\n\n').length).toBeGreaterThan(2)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle rules without descriptions', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-nodesc-'))
    const agentsPath = join(tempDir, 'AGENTS.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'basic-rule',
          alwaysApply: true
        },
        content: 'Always use TypeScript'
      }
    ]

    try {
      exportToOpenCode(rules, agentsPath)

      const exported = readFileSync(agentsPath, 'utf8')
      
      // Should not have a generated header if no description
      expect(exported.split('\n')[0]).not.toMatch(/^\s#/)
      expect(exported.trim()).toBe('Always use TypeScript')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should preserve content formatting during import/export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-preserve-'))
    const agentsPath = join(tempDir, 'AGENTS.md')
    
    const originalContent = `# Development Guidelines

## Code Structure

\`\`\`
src/
  components/
  utils/
  types/
\`\`\`

### Important Notes

1. Always validate inputs
2. Handle errors gracefully
3. Write tests first

> Remember: Clean code is better than clever code`

    writeFileSync(agentsPath, originalContent, 'utf8')

    try {
      // Import
      const imported = importOpenCode(agentsPath)
      
      // Export to a different location
      const exportPath = join(tempDir, 'AGENTS-exported.md')
      exportToOpenCode(imported.rules, exportPath)
      
      const exported = readFileSync(exportPath, 'utf8')
      
      // The content should be preserved (with added header)
      expect(exported).toContain('# OpenCode agents and instructions')
      expect(exported).toContain('Always validate inputs')
      expect(exported).toContain('Clean code is better than clever code')
      
      // Verify Markdown structures are preserved
      expect(exported).toMatch(/```[\s\S]*?```/)  // Code blocks
      expect(exported).toMatch(/^\d+\.\s/m)       // Ordered lists
      expect(exported).toMatch(/^>\s/m)           // Blockquotes
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle private rules correctly', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-private-'))
    const agentsPath = join(tempDir, 'AGENTS.local.md')
    
    const content = `# Private Rules

These are private rules that should not be exported by default.

## Secret Commands

- Use secret API endpoints
- Apply internal coding standards`

    writeFileSync(agentsPath, content, 'utf8')

    try {
      const result = importOpenCode(agentsPath)

      expect(result.format).toBe('opencode')
      expect(result.rules[0].metadata.private).toBe(true)
      expect(result.rules[0].metadata.id).toBe('opencode-agents')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should filter private rules in export unless includePrivate is true', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-filter-'))
    const agentsPath = join(tempDir, 'AGENTS.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public-rule',
          description: 'Public Rule',
          alwaysApply: true
        },
        content: 'This is a public rule'
      },
      {
        metadata: {
          id: 'private-rule',
          description: 'Private Rule',
          alwaysApply: true,
          private: true
        },
        content: 'This is a private rule'
      }
    ]

    try {
      // Export without includePrivate (default)
      exportToOpenCode(rules, agentsPath)
      let exported = readFileSync(agentsPath, 'utf8')
      expect(exported).toContain('Public Rule')
      expect(exported).not.toContain('Private Rule')

      // Export with includePrivate
      exportToOpenCode(rules, agentsPath, { includePrivate: true })
      exported = readFileSync(agentsPath, 'utf8')
      expect(exported).toContain('Public Rule')
      expect(exported).toContain('Private Rule')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle conditional rules correctly', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'opencode-conditional-'))
    const agentsPath = join(tempDir, 'AGENTS.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'global-rule',
          description: 'Global Rule',
          alwaysApply: true
        },
        content: 'This rule applies everywhere'
      },
      {
        metadata: {
          id: 'frontend/components',
          description: 'Component Rules',
          alwaysApply: false,
          scope: 'src/components/**'
        },
        content: 'Use functional components with hooks'
      }
    ]

    try {
      exportToOpenCode(rules, agentsPath)
      const exported = readFileSync(agentsPath, 'utf8')
      
      expect(exported).toContain('# Global Rule')
      expect(exported).toContain('This rule applies everywhere')
      expect(exported).toContain('## Context-Specific Rules')
      expect(exported).toContain('When working with files matching `src/components/**`')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})