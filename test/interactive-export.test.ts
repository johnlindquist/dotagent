import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exportToCopilot, exportToCursor, exportToCline } from '../src/exporters.js'
import type { RuleBlock } from '../src/types.js'

describe('Interactive export functionality', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'interactive-export-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should export to individual formats correctly', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'test-rule',
          alwaysApply: true,
          description: 'Test rule'
        },
        content: '# Test Rule\n\nThis is a test rule.'
      },
      {
        metadata: {
          id: 'conditional-rule',
          alwaysApply: false,
          scope: '**/*.ts',
          description: 'TypeScript rule'
        },
        content: '# TypeScript Rule\n\nTypeScript specific guidelines.'
      }
    ]

    // Test Copilot export
    const copilotPath = join(tempDir, '.github', 'copilot-instructions.md')
    exportToCopilot(rules, copilotPath)
    
    expect(existsSync(copilotPath)).toBe(true)
    const copilotContent = readFileSync(copilotPath, 'utf-8')
    expect(copilotContent).toContain('# Test Rule')
    expect(copilotContent).toContain('## Context-Specific Rules')
    expect(copilotContent).toContain('When working with files matching `**/*.ts`')

    // Test Cursor export
    exportToCursor(rules, tempDir)
    
    const cursorRulePath = join(tempDir, '.cursor', 'rules', 'test-rule.mdc')
    const cursorConditionalPath = join(tempDir, '.cursor', 'rules', 'conditional-rule.mdc')
    
    expect(existsSync(cursorRulePath)).toBe(true)
    expect(existsSync(cursorConditionalPath)).toBe(true)

    // Test Cline export
    const clinePath = join(tempDir, '.clinerules')
    exportToCline(rules, clinePath)
    
    expect(existsSync(clinePath)).toBe(true)
    const clineContent = readFileSync(clinePath, 'utf-8')
    expect(clineContent).toContain('## Test rule')
    expect(clineContent).toContain('# Test Rule')
  })

  it('should generate correct gitignore patterns', () => {
    const paths = [
      '.github/copilot-instructions.md',
      '.cursor/rules/',
      '.clinerules',
      'CLAUDE.md'
    ]

    const expectedPatterns = [
      '.github/copilot-instructions.md',
      '.cursor/rules/**',
      '.clinerules',
      'CLAUDE.md'
    ]

    paths.forEach((path, index) => {
      const pattern = path.endsWith('/') ? path + '**' : path
      expect(pattern).toBe(expectedPatterns[index])
    })
  })

  it('should handle export options correctly', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public-rule',
          alwaysApply: true
        },
        content: 'Public rule content'
      },
      {
        metadata: {
          id: 'private-rule',
          alwaysApply: true,
          private: true
        },
        content: 'Private rule content'
      }
    ]

    // Export without private rules
    const publicPath = join(tempDir, 'public.md')
    exportToCopilot(rules, publicPath, { includePrivate: false })
    
    const publicContent = readFileSync(publicPath, 'utf-8')
    expect(publicContent).toContain('Public rule content')
    expect(publicContent).not.toContain('Private rule content')

    // Export with private rules
    const allPath = join(tempDir, 'all.md')
    exportToCopilot(rules, allPath, { includePrivate: true })
    
    const allContent = readFileSync(allPath, 'utf-8')
    expect(allContent).toContain('Public rule content')
    expect(allContent).toContain('Private rule content')
  })
})