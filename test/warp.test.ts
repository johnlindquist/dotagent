import { describe, it, expect } from 'vitest'
import { importWarp, exportToWarp } from '../src/index.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src/types.js'

describe('Warp format', () => {
  it('should import WARP.md file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-test-'))
    const warpPath = join(tempDir, 'WARP.md')
    
    const content = `# Terminal Configuration

This project uses specific terminal configurations for optimal development experience.

## Shell Setup

- Use Zsh with Oh My Zsh
- Configure custom aliases for common commands
- Enable syntax highlighting

## Development Workflow

\`\`\`bash
npm run dev      # Start development server
npm run test     # Run tests
npm run build    # Build for production
\`\`\`

## Terminal Features

Enable the following Warp features:
- AI Command Suggestions
- Workflow automation
- Shared sessions`

    writeFileSync(warpPath, content, 'utf8')

    try {
      const result = importWarp(warpPath)

      expect(result.format).toBe('warp')
      expect(result.filePath).toBe(warpPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('warp-rules')
      expect(result.rules[0].metadata.alwaysApply).toBe(true)
      expect(result.rules[0].metadata.description).toBe('Warp.dev terminal rules and instructions')
      expect(result.rules[0].content).toContain('Terminal Configuration')
      expect(result.rules[0].content).toContain('npm run dev')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should import WARP.local.md file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-local-test-'))
    const warpLocalPath = join(tempDir, 'WARP.local.md')
    
    const content = `# Private Terminal Settings

## Local Development

Port configurations for local services:
- API server: 3001
- Database: 5432
- Redis: 6379

## Personal Aliases

Custom aliases for personal workflow:
- \`gs\` for git status
- \`gp\` for git push
- \`gd\` for git diff`

    writeFileSync(warpLocalPath, content, 'utf8')

    try {
      const result = importWarp(warpLocalPath)

      expect(result.format).toBe('warp')
      expect(result.filePath).toBe(warpLocalPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('warp-rules')
      expect(result.rules[0].metadata.private).toBe(true)
      expect(result.rules[0].content).toContain('Private Terminal Settings')
      expect(result.rules[0].content).toContain('Port configurations')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export to WARP.md format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-export-'))
    const warpPath = join(tempDir, 'WARP.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'terminal-setup',
          description: 'Terminal Setup Instructions',
          alwaysApply: true
        },
        content: `## Environment Setup

Use Warp terminal with the following configurations:

### Required Features
- AI-powered autocomplete
- Command suggestions
- Workflow automation

### Theme Configuration
- Dark mode enabled
- Custom font: Fira Code
- Font size: 14px`
      },
      {
        metadata: {
          id: 'development-workflow',
          description: 'Development Workflow'
        },
        content: `## Common Commands

\`\`\`bash
npm run dev      # Start development server
npm run test     # Run tests with coverage
npm run lint     # Run ESLint
npm run build    # Build for production
\`\`\`

### Git Workflow
- Feature branches from main
- Pull requests required
- Automated CI/CD`
      }
    ]

    try {
      exportToWarp(rules, warpPath)

      const exported = readFileSync(warpPath, 'utf8')
      
      // Should include headers from descriptions
      expect(exported).toContain('# Terminal Setup Instructions')
      expect(exported).toContain('# Development Workflow')
      
      // Should include content
      expect(exported).toContain('Use Warp terminal with the following configurations')
      expect(exported).toContain('npm run dev')
      
      // Should separate rules with double newlines
      expect(exported.split('\n\n').length).toBeGreaterThan(2)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export private rules when includePrivate option is set', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-private-export-'))
    const warpPath = join(tempDir, 'WARP.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public-config',
          description: 'Public Configuration',
          alwaysApply: true,
          private: false
        },
        content: `## Public Environment

Production server runs on port 443.
Database connection uses production credentials.`
      },
      {
        metadata: {
          id: 'private-config',
          description: 'Private Configuration',
          alwaysApply: true,
          private: true
        },
        content: `## Local Environment

Development server runs on port 8000.
Database connection uses local credentials.`
      }
    ]

    try {
      // Export with private rules included
      exportToWarp(rules, warpPath, { includePrivate: true })

      const exported = readFileSync(warpPath, 'utf8')
      
      expect(exported).toContain('# Public Configuration')
      expect(exported).toContain('# Private Configuration')
      expect(exported).toContain('Development server runs on port 8000')
      expect(exported).toContain('Production server runs on port 443')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle rules without descriptions', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-nodesc-'))
    const warpPath = join(tempDir, 'WARP.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'basic-rule',
          alwaysApply: true
        },
        content: 'Always use Zsh as default shell'
      }
    ]

    try {
      exportToWarp(rules, warpPath)

      const exported = readFileSync(warpPath, 'utf8')
      
      // Should not have a header if no description
      expect(exported).not.toContain('#')
      expect(exported.trim()).toBe('Always use Zsh as default shell')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should perform round-trip conversion (import → export → import)', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-roundtrip-'))
    const originalPath = join(tempDir, 'WARP.md')
    const exportPath = join(tempDir, 'WARP-exported.md')
    
    const originalContent = `# Warp Terminal Configuration

## Shell Preferences

- Default shell: Zsh
- Prompt theme: Powerlevel10k
- History size: 10000

## Development Commands

\`\`\`bash
npm run dev      # Start development server
npm run test     # Run tests
npm run build    # Build for production
\`\`\`

## Workflow Automation

Set up the following workflows:
1. Auto-start development server on project open
2. Run tests on file changes
3. Auto-format code on save`

    writeFileSync(originalPath, originalContent, 'utf8')

    try {
      // Import original
      const imported = importWarp(originalPath)
      
      // Export to new file
      exportToWarp(imported.rules, exportPath)
      
      // Import exported file
      const reimported = importWarp(exportPath)
      
      // Verify content is preserved
      expect(reimported.rules[0].content).toContain('Warp Terminal Configuration')
      expect(reimported.rules[0].content).toContain('Shell Preferences')
      expect(reimported.rules[0].content).toContain('npm run dev')
      expect(reimported.rules[0].content).toContain('Workflow Automation')
      
      // Verify metadata is preserved
      expect(reimported.rules[0].metadata.id).toBe('warp-rules')
      expect(reimported.rules[0].metadata.alwaysApply).toBe(true)
      expect(reimported.rules[0].metadata.description).toBe('Warp.dev terminal rules and instructions')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle private rules with Warp format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-private-'))
    const warpPath = join(tempDir, 'WARP.md')
    
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public-rule',
          description: 'Public Rule',
          alwaysApply: true,
          private: false
        },
        content: 'This is a public rule that should be included.'
      },
      {
        metadata: {
          id: 'private-rule',
          description: 'Private Rule',
          alwaysApply: true,
          private: true
        },
        content: 'This is a private rule with sensitive information.'
      }
    ]

    try {
      // Export without private rules (default behavior)
      exportToWarp(rules, warpPath)
      
      let exported = readFileSync(warpPath, 'utf8')
      expect(exported).toContain('Public Rule')
      expect(exported).not.toContain('Private Rule')
      
      // Export with private rules
      exportToWarp(rules, warpPath, { includePrivate: true })
      
      exported = readFileSync(warpPath, 'utf8')
      expect(exported).toContain('Public Rule')
      expect(exported).toContain('Private Rule')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle conditional rules with Warp format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-conditional-'))
    const warpPath = join(tempDir, 'WARP.md')
    
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'always-rule',
          description: 'Always Applied Rule',
          alwaysApply: true
        },
        content: 'This rule is always applied to all terminal sessions.'
      },
      {
        metadata: {
          id: 'conditional-rule',
          description: 'Conditional Rule',
          alwaysApply: false,
          scope: ['src/**/*.ts', 'test/**/*.ts']
        },
        content: 'This rule only applies when working with TypeScript files.'
      },
      {
        metadata: {
          id: 'manual-rule',
          description: 'Manual Rule',
          alwaysApply: false,
          manual: true,
          triggers: ['@workflow-setup']
        },
        content: 'This rule must be manually triggered.'
      }
    ]

    try {
      exportToWarp(rules, warpPath)
      
      const exported = readFileSync(warpPath, 'utf8')
      
      // Should include always-apply rule content directly
      expect(exported).toContain('Always Applied Rule')
      expect(exported).toContain('This rule is always applied')
      
      // Should include conditional rules section
      expect(exported).toContain('Context-Specific Rules')
      expect(exported).toContain('When working with files matching `src/**/*.ts`')
      expect(exported).toContain('When working with files matching `test/**/*.ts`')
      expect(exported).toContain('[conditional-rule]')
      expect(exported).toContain('When working with Manual Rule')
      expect(exported).toContain('[manual-rule]')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle empty WARP.md files', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-empty-'))
    const warpPath = join(tempDir, 'WARP.md')
    
    writeFileSync(warpPath, '', 'utf8')

    try {
      const result = importWarp(warpPath)

      expect(result.format).toBe('warp')
      expect(result.filePath).toBe(warpPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('warp-rules')
      expect(result.rules[0].content).toBe('')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle malformed WARP.md files', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-malformed-'))
    const warpPath = join(tempDir, 'WARP.md')
    
    const malformedContent = `# Incomplete markdown

This is a malformed file with
- Unclosed list item
\`\`\`bash
npm run command
# Missing closing code block

Another section without proper formatting`

    writeFileSync(warpPath, malformedContent, 'utf8')

    try {
      const result = importWarp(warpPath)

      expect(result.format).toBe('warp')
      expect(result.filePath).toBe(warpPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('warp-rules')
      
      // Should still import the content as-is
      expect(result.rules[0].content).toContain('Incomplete markdown')
      expect(result.rules[0].content).toContain('Unclosed list item')
      expect(result.rules[0].content).toContain('npm run command')
      expect(result.rules[0].content).toContain('Another section')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should preserve content formatting during import/export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'warp-preserve-'))
    const warpPath = join(tempDir, 'WARP.md')
    
    const originalContent = `# Terminal Guidelines

## Command Structure

\`\`\`
src/
  components/
  utils/
  types/
\`\`\`

### Important Notes

1. Always validate commands before execution
2. Handle errors gracefully
3. Use version control for all configuration changes

> Remember: A well-configured terminal improves productivity`

    writeFileSync(warpPath, originalContent, 'utf8')

    try {
      // Import
      const imported = importWarp(warpPath)
      
      // Export to a different location
      const exportPath = join(tempDir, 'WARP-exported.md')
      exportToWarp(imported.rules, exportPath)
      
      const exported = readFileSync(exportPath, 'utf8')
      
      // The content should be preserved
      expect(exported).toContain('# Warp.dev terminal rules and instructions')
      expect(exported).toContain('Always validate commands before execution')
      expect(exported).toContain('A well-configured terminal improves productivity')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})