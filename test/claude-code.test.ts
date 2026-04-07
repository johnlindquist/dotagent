import { describe, it, expect } from 'vitest'
import { importClaudeCode, importClaudeCodeRules, exportToClaudeCode } from '../src'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src'

describe('Claude Code format', () => {
  it('should import CLAUDE.md file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-test-'))
    const claudePath = join(tempDir, 'CLAUDE.md')

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

    writeFileSync(claudePath, content, 'utf8')

    try {
      const result = importClaudeCode(claudePath)

      expect(result.format).toBe('claude')
      expect(result.filePath).toBe(claudePath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('claude-code-instructions')
      expect(result.rules[0].metadata.alwaysApply).toBe(true)
      expect(result.rules[0].content).toContain('Project Context')
      expect(result.rules[0].content).toContain('npm run dev')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export always-apply rules to CLAUDE.md', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-export-'))

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
          description: 'Code Style Guidelines',
          alwaysApply: true
        },
        content: `## Formatting

- 2 space indentation
- Single quotes for strings
- No semicolons`
      }
    ]

    try {
      exportToClaudeCode(rules, tempDir)

      const exported = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf8')

      // Should include headers from descriptions
      expect(exported).toContain('# Project Setup Instructions')
      expect(exported).toContain('# Code Style Guidelines')

      // Should include content
      expect(exported).toContain('Use Node.js 20+ and pnpm')
      expect(exported).toContain('2 space indentation')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export scoped rules to .claude/rules/', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-scoped-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'general',
          alwaysApply: true
        },
        content: 'General instructions'
      },
      {
        metadata: {
          id: 'typescript-rules',
          alwaysApply: false,
          description: 'TypeScript conventions',
          globs: ['src/**/*.ts']
        },
        content: 'Use strict TypeScript.'
      },
      {
        metadata: {
          id: 'test-rules',
          alwaysApply: false,
          description: 'Testing conventions',
          scope: '**/*.test.ts'
        },
        content: 'Write comprehensive tests.'
      }
    ]

    try {
      exportToClaudeCode(rules, tempDir)

      // CLAUDE.md should only have always-apply rules
      const claudeMd = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf8')
      expect(claudeMd).toContain('General instructions')
      expect(claudeMd).not.toContain('Use strict TypeScript')

      // Scoped rules in .claude/rules/
      const tsRule = readFileSync(join(tempDir, '.claude', 'rules', 'typescript-rules.md'), 'utf8')
      expect(tsRule).toContain('description: TypeScript conventions')
      expect(tsRule).toContain('globs:')
      expect(tsRule).toContain('src/**/*.ts')
      expect(tsRule).toContain('alwaysApply: false')
      expect(tsRule).toContain('Use strict TypeScript.')

      // scope should be mapped to globs
      const testRule = readFileSync(join(tempDir, '.claude', 'rules', 'test-rules.md'), 'utf8')
      expect(testRule).toContain('globs:')
      expect(testRule).toContain('**/*.test.ts')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export nested rule IDs to subdirectories', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-nested-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'api/auth',
          alwaysApply: false,
          description: 'Auth API rules'
        },
        content: 'Auth rules content'
      }
    ]

    try {
      exportToClaudeCode(rules, tempDir)

      const filePath = join(tempDir, '.claude', 'rules', 'api', 'auth.md')
      expect(existsSync(filePath)).toBe(true)
      const content = readFileSync(filePath, 'utf8')
      expect(content).toContain('Auth rules content')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should not produce CLAUDE.md when only scoped rules exist', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-nomain-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'scoped-only',
          alwaysApply: false,
          description: 'Only scoped'
        },
        content: 'Scoped content'
      }
    ]

    try {
      exportToClaudeCode(rules, tempDir)

      expect(existsSync(join(tempDir, 'CLAUDE.md'))).toBe(false)
      expect(existsSync(join(tempDir, '.claude', 'rules', 'scoped-only.md'))).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should import .claude/rules/ directory', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-import-rules-'))
    const rulesDir = join(tempDir, '.claude', 'rules')
    mkdirSync(rulesDir, { recursive: true })

    writeFileSync(join(rulesDir, 'coding-style.md'), `---
description: Coding style rules
globs:
  - src/**/*.ts
alwaysApply: false
---
Use consistent naming.`, 'utf8')

    writeFileSync(join(rulesDir, 'general.md'), `---
description: General rules
alwaysApply: true
---
Follow best practices.`, 'utf8')

    try {
      const result = importClaudeCodeRules(rulesDir)

      expect(result.format).toBe('claude')
      expect(result.rules).toHaveLength(2)

      const codingRule = result.rules.find(r => r.metadata.id === 'coding-style')!
      expect(codingRule.metadata.description).toBe('Coding style rules')
      expect(codingRule.metadata.alwaysApply).toBe(false)
      expect(codingRule.metadata.globs).toEqual(['src/**/*.ts'])
      expect(codingRule.metadata.scope).toEqual(['src/**/*.ts'])
      expect(codingRule.content).toBe('Use consistent naming.')

      const generalRule = result.rules.find(r => r.metadata.id === 'general')!
      expect(generalRule.metadata.alwaysApply).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should default alwaysApply to false when importing rules', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-default-'))
    const rulesDir = join(tempDir, '.claude', 'rules')
    mkdirSync(rulesDir, { recursive: true })

    writeFileSync(join(rulesDir, 'no-always.md'), `---
description: No alwaysApply field
---
Some content.`, 'utf8')

    try {
      const result = importClaudeCodeRules(rulesDir)
      expect(result.rules[0].metadata.alwaysApply).toBe(false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should round-trip scoped rules through export and import', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-roundtrip-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'style-guide',
          alwaysApply: false,
          description: 'Style guide',
          globs: ['src/**/*.ts', 'lib/**/*.ts']
        },
        content: 'Follow the style guide.'
      }
    ]

    try {
      exportToClaudeCode(rules, tempDir)

      const rulesDir = join(tempDir, '.claude', 'rules')
      const imported = importClaudeCodeRules(rulesDir)

      expect(imported.rules).toHaveLength(1)
      const rule = imported.rules[0]
      expect(rule.metadata.id).toBe('style-guide')
      expect(rule.metadata.description).toBe('Style guide')
      expect(rule.metadata.alwaysApply).toBe(false)
      expect(rule.metadata.globs).toEqual(['src/**/*.ts', 'lib/**/*.ts'])
      expect(rule.content).toBe('Follow the style guide.')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should preserve content formatting during import/export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-preserve-'))
    const claudePath = join(tempDir, 'CLAUDE.md')

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

    writeFileSync(claudePath, originalContent, 'utf8')

    try {
      // Import
      const imported = importClaudeCode(claudePath)

      // Export to a different location
      const exportDir = join(tempDir, 'export')
      mkdirSync(exportDir, { recursive: true })
      exportToClaudeCode(imported.rules, exportDir)

      const exported = readFileSync(join(exportDir, 'CLAUDE.md'), 'utf8')

      // The content should be preserved (with added header)
      expect(exported).toContain('# Claude Code context and instructions')
      expect(exported).toContain('Always validate inputs')
      expect(exported).toContain('Clean code is better than clever code')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
