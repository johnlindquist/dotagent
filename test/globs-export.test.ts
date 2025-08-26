import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exportToCursor } from '../src/exporters.js'
import type { RuleBlock } from '../src/types.js'

describe('Export glob pattern formatting', () => {
  let tempDir: string
  let rules: RuleBlock[]

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cursor-globs-test-'))
    
    rules = [
      {
        metadata: {
          id: 'typescript-rule',
          alwaysApply: false,
          globs: '*.ts',
          description: 'TypeScript files'
        },
        content: '# TypeScript Rule\n\nTypeScript specific guidelines.'
      },
      {
        metadata: {
          id: 'react-rule',
          alwaysApply: false,
          globs: ['*.tsx', '**/*.tsx'],
          description: 'React components'
        },
        content: '# React Rule\n\nReact component guidelines.'
      },
      {
        metadata: {
          id: 'complex-globs',
          alwaysApply: false,
          globs: '**/*.{ts,tsx,js,jsx}',
          description: 'Multiple file types'
        },
        content: '# Complex Globs\n\nMultiple file type support.'
      },
      {
        metadata: {
          id: 'comma-separated-globs',
          alwaysApply: false,
          globs: '*.tsx,*.ts',
          description: 'Comma-separated globs'
        },
        content: '# Comma-separated Globs\n\nMultiple comma-separated patterns.'
      },
      {
        metadata: {
          id: 'mixed-pattern-globs',
          alwaysApply: false,
          globs: '**/*.tsx,tests/maestro/**/*.yaml',
          description: 'Mixed pattern globs - leading star and path prefix'
        },
        content: '# Mixed Pattern Globs\n\nLeading star and path prefix patterns.'
      },
      {
        metadata: {
          id: 'scope-rule',
          alwaysApply: false,
          scope: '*.md',
          description: 'Markdown files'
        },
        content: '# Scope Rule\n\nMarkdown guidelines.'
      }
    ]
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should export globs without quotes for simple patterns', () => {
    exportToCursor(rules, tempDir)
    
    const typescriptRulePath = join(tempDir, '.cursor', 'rules', 'typescript-rule.mdc')
    const content = readFileSync(typescriptRulePath, 'utf-8')
    
    // Should contain unquoted glob pattern (universal behavior)
    expect(content).toContain('globs: *.ts')
    // Should not contain quoted pattern
    expect(content).not.toContain('globs: "*.ts"')
    expect(content).not.toContain("globs: '*.ts'")
  })

  it('should export globs without quotes for complex patterns', () => {
    exportToCursor(rules, tempDir)
    
    const complexRulePath = join(tempDir, '.cursor', 'rules', 'complex-globs.mdc')
    const content = readFileSync(complexRulePath, 'utf-8')
    
    // Should contain unquoted complex glob pattern
    expect(content).toContain('globs: **/*.{ts,tsx,js,jsx}')
    // Should not contain quoted pattern
    expect(content).not.toContain('globs: "**/*.{ts,tsx,js,jsx}"')
    expect(content).not.toContain("globs: '**/*.{ts,tsx,js,jsx}'")
  })

  it('should export array globs without quotes', () => {
    exportToCursor(rules, tempDir)
    
    const reactRulePath = join(tempDir, '.cursor', 'rules', 'react-rule.mdc')
    const content = readFileSync(reactRulePath, 'utf-8')
    
    // Should contain unquoted array items
    expect(content).toContain('- *.tsx')
    expect(content).toContain('- **/*.tsx')
    // Should not contain quoted array items
    expect(content).not.toContain('- "*.tsx"')
    expect(content).not.toContain("- '*.tsx'")
  })

  it('should export comma-separated globs without quotes', () => {
    exportToCursor(rules, tempDir)
    
    const commaRulePath = join(tempDir, '.cursor', 'rules', 'comma-separated-globs.mdc')
    const content = readFileSync(commaRulePath, 'utf-8')
    
    // Should contain unquoted comma-separated pattern
    expect(content).toContain('globs: *.tsx,*.ts')
    // Should not contain quoted pattern
    expect(content).not.toContain('globs: "*.tsx,*.ts"')
    expect(content).not.toContain("globs: '*.tsx,*.ts'")
  })

  it('should export mixed pattern globs without quotes (leading star + path prefix)', () => {
    exportToCursor(rules, tempDir)
    
    const mixedRulePath = join(tempDir, '.cursor', 'rules', 'mixed-pattern-globs.mdc')
    const content = readFileSync(mixedRulePath, 'utf-8')
    
    // Should contain unquoted mixed pattern - this is the problematic case you found
    expect(content).toContain('globs: **/*.tsx,tests/maestro/**/*.yaml')
    // Should not contain quoted pattern
    expect(content).not.toContain('globs: "**/*.tsx,tests/maestro/**/*.yaml"')
    expect(content).not.toContain("globs: '**/*.tsx,tests/maestro/**/*.yaml'")
  })

  it('should keep scope patterns quoted (scope is not a glob field)', () => {
    exportToCursor(rules, tempDir)
    
    const scopeRulePath = join(tempDir, '.cursor', 'rules', 'scope-rule.mdc')
    const content = readFileSync(scopeRulePath, 'utf-8')
    
    // Should contain quoted scope pattern (scope is not unquoted like globs)
    expect(content).toMatch(/scope: ['"]?\*\.md['"]?/)
  })

  it('should preserve other YAML structure correctly', () => {
    exportToCursor(rules, tempDir)
    
    const typescriptRulePath = join(tempDir, '.cursor', 'rules', 'typescript-rule.mdc')
    const content = readFileSync(typescriptRulePath, 'utf-8')
    
    // Should have proper frontmatter structure
    expect(content).toMatch(/^---\s*\n/)
    expect(content).toContain('description: TypeScript files')
    expect(content).toContain('alwaysApply: false')
    expect(content).toMatch(/---\s*\n# TypeScript Rule/)
  })

  it('should match original cursor format expectations', () => {
    // This test verifies that our output matches the expected format
    // that was working in the original .cursor-rules-old/docs.mdc
    exportToCursor([{
      metadata: {
        id: 'documentation',
        alwaysApply: false,
        globs: '*.md'
      },
      content: '# Documentation Best Practices\n\nDocumentation guidelines.'
    }], tempDir)
    
    const docRulePath = join(tempDir, '.cursor', 'rules', 'documentation.mdc')
    const content = readFileSync(docRulePath, 'utf-8')
    
    // Should match the original format: globs: *.md (not quoted)
    expect(content).toContain('globs: *.md')
    expect(content).toContain('alwaysApply: false')
    
    // Verify the exact format matches what Cursor expects
    const frontmatterMatch = content.match(/^---([\s\S]*?)---/)
    expect(frontmatterMatch).toBeTruthy()
    
    const frontmatter = frontmatterMatch![1]
    expect(frontmatter).toContain('globs: *.md')
    expect(frontmatter).not.toMatch(/globs:\s*['"]/)
  })
})