import { describe, it, expect } from 'vitest'
import { importClaudeCode, exportToClaudeCode } from '../src/index.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src/types.js'

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

  it('should export to CLAUDE.md format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-export-'))
    const claudePath = join(tempDir, 'CLAUDE.md')

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
      exportToClaudeCode(rules, claudePath)

      const exported = readFileSync(claudePath, 'utf8')
      
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
    const tempDir = mkdtempSync(join(tmpdir(), 'claude-nodesc-'))
    const claudePath = join(tempDir, 'CLAUDE.md')

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
      exportToClaudeCode(rules, claudePath)

      const exported = readFileSync(claudePath, 'utf8')
      
      // Should not have a header if no description
      expect(exported).not.toContain('#')
      expect(exported.trim()).toBe('Always use TypeScript')
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
      const exportPath = join(tempDir, 'CLAUDE-exported.md')
      exportToClaudeCode(imported.rules, exportPath)
      
      const exported = readFileSync(exportPath, 'utf8')
      
      // The content should be preserved (with added header)
      expect(exported).toContain('# Claude Code context and instructions')
      expect(exported).toContain('Always validate inputs')
      expect(exported).toContain('Clean code is better than clever code')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})