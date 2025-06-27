import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exportToCopilot, exportToClaudeCode, exportToWindsurf } from '../src/exporters.js'
import type { RuleBlock } from '../src/types.js'

describe('Conditional rules export', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agentconfig-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should export conditional rules section when rules have scope', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'general-guidelines',
          alwaysApply: true,
          description: 'General coding guidelines'
        },
        content: '# General Guidelines\n\nAlways write clean code.'
      },
      {
        metadata: {
          id: 'typescript/style-guide',
          alwaysApply: false,
          scope: 'src/**/*.ts',
          description: 'TypeScript style guidelines'
        },
        content: '# TypeScript Style\n\nUse strict mode.'
      },
      {
        metadata: {
          id: 'testing/jest-rules',
          alwaysApply: false,
          scope: ['**/*.test.js', '**/*.spec.js'],
          description: 'Jest testing conventions'
        },
        content: '# Jest Testing\n\nWrite comprehensive tests.'
      }
    ]

    const outputPath = join(tempDir, '.github', 'copilot-instructions.md')
    exportToCopilot(rules, outputPath)

    const content = readFileSync(outputPath, 'utf-8')
    
    // Check main content
    expect(content).toContain('# General Guidelines')
    expect(content).toContain('Always write clean code.')
    
    // Check conditional rules section
    expect(content).toContain('## Context-Specific Rules')
    expect(content).toContain('When working with files matching `src/**/*.ts`, also apply:')
    expect(content).toContain('→ [typescript/style-guide](.agent/typescript/style-guide.md) - TypeScript style guidelines')
    expect(content).toContain('When working with files matching `**/*.test.js`, also apply:')
    expect(content).toContain('→ [testing/jest-rules](.agent/testing/jest-rules.md) - Jest testing conventions')
    
    // Should not include conditional rule content in main section
    expect(content).not.toContain('# TypeScript Style')
    expect(content).not.toContain('Use strict mode.')
  })

  it('should export conditional rules with description keywords', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'always-apply',
          alwaysApply: true
        },
        content: 'Always apply this rule.'
      },
      {
        metadata: {
          id: 'database-patterns',
          alwaysApply: false,
          description: 'database queries and SQL operations'
        },
        content: '# Database Patterns\n\nUse parameterized queries.'
      }
    ]

    const outputPath = join(tempDir, 'CLAUDE.md')
    exportToClaudeCode(rules, outputPath)

    const content = readFileSync(outputPath, 'utf-8')
    
    expect(content).toContain('Always apply this rule.')
    expect(content).toContain('## Context-Specific Rules')
    expect(content).toContain('When working with database queries and SQL operations, also apply:')
    expect(content).toContain('→ [database-patterns](.agent/database-patterns.md)')
  })

  it('should create workflow sections for folder-based rules', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'general',
          alwaysApply: true
        },
        content: 'General rules'
      },
      {
        metadata: {
          id: 'workflows/pr-review',
          alwaysApply: false,
          description: 'Pull request review workflow'
        },
        content: 'PR review steps'
      },
      {
        metadata: {
          id: 'workflows/deployment',
          alwaysApply: false,
          description: 'Deployment workflow'
        },
        content: 'Deployment steps'
      }
    ]

    const outputPath = join(tempDir, 'AGENTS.md')
    exportToClaudeCode(rules, outputPath)

    const content = readFileSync(outputPath, 'utf-8')
    
    expect(content).toContain('## Workflows')
    expect(content).toContain('→ [workflows/pr-review](.agent/workflows/pr-review.md) - Pull request review workflow')
    expect(content).toContain('→ [workflows/deployment](.agent/workflows/deployment.md) - Deployment workflow')
  })

  it('should not add conditional section when all rules have alwaysApply', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'rule1',
          alwaysApply: true
        },
        content: 'Rule 1 content'
      },
      {
        metadata: {
          id: 'rule2',
          alwaysApply: true
        },
        content: 'Rule 2 content'
      }
    ]

    const outputPath = join(tempDir, '.windsurfrules')
    exportToWindsurf(rules, outputPath)

    const content = readFileSync(outputPath, 'utf-8')
    
    expect(content).toContain('Rule 1 content')
    expect(content).toContain('Rule 2 content')
    expect(content).not.toContain('## Context-Specific Rules')
  })
})