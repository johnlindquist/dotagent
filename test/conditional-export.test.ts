import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exportToCopilot, exportToClaudeCode, exportToWindsurf } from '../src'
import type { RuleBlock } from '../src'

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

  it('should export scoped rules to .claude/rules/ directory', () => {
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

    exportToClaudeCode(rules, tempDir)

    // Always-apply rule should be in CLAUDE.md
    const claudeMd = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('Always apply this rule.')

    // Scoped rule should be in .claude/rules/ as individual file
    const rulePath = join(tempDir, '.claude', 'rules', 'database-patterns.md')
    expect(existsSync(rulePath)).toBe(true)
    const ruleContent = readFileSync(rulePath, 'utf-8')
    expect(ruleContent).toContain('description: database queries and SQL operations')
    expect(ruleContent).toContain('alwaysApply: false')
    expect(ruleContent).toContain('Use parameterized queries.')
  })

  it('should export nested folder-based rules to .claude/rules/', () => {
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

    exportToClaudeCode(rules, tempDir)

    // Nested rules should be in subdirectories
    const prPath = join(tempDir, '.claude', 'rules', 'workflows', 'pr-review.md')
    const deployPath = join(tempDir, '.claude', 'rules', 'workflows', 'deployment.md')
    expect(existsSync(prPath)).toBe(true)
    expect(existsSync(deployPath)).toBe(true)

    const prContent = readFileSync(prPath, 'utf-8')
    expect(prContent).toContain('PR review steps')
    expect(prContent).toContain('description: Pull request review workflow')
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
