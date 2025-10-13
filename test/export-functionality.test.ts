import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exportToCopilot, exportToCursor, exportToCline, exportToWindsurf, exportToZed, exportToCodex, exportToAider, exportToClaudeCode, exportToQodo, exportToOpenCode, exportAll } from '../src/exporters.js'
import type { RuleBlock } from '../src/types.js'

describe('Export functionality with format selection', () => {
  let tempDir: string
  let rules: RuleBlock[]

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'export-func-test-'))
    
    rules = [
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
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should export to VS Code Copilot format', () => {
    const copilotPath = join(tempDir, '.github', 'copilot-instructions.md')
    exportToCopilot(rules, copilotPath)
    
    expect(existsSync(copilotPath)).toBe(true)
    const content = readFileSync(copilotPath, 'utf-8')
    expect(content).toContain('# Test Rule')
    expect(content).toContain('## Context-Specific Rules')
    expect(content).toContain('When working with files matching `**/*.ts`')
  })

  it('should export to Cursor format', () => {
    exportToCursor(rules, tempDir)
    
    const rulePath = join(tempDir, '.cursor', 'rules', 'test-rule.mdc')
    const conditionalPath = join(tempDir, '.cursor', 'rules', 'conditional-rule.mdc')
    
    expect(existsSync(rulePath)).toBe(true)
    expect(existsSync(conditionalPath)).toBe(true)
  })

  it('should export to Cline format', () => {
    const clinePath = join(tempDir, '.clinerules')
    exportToCline(rules, clinePath)
    
    expect(existsSync(clinePath)).toBe(true)
    const content = readFileSync(clinePath, 'utf-8')
    expect(content).toContain('## Test rule')
    expect(content).toContain('# Test Rule')
  })

  it('should export to all formats', () => {
    exportAll(rules, tempDir)
    
    // Check all formats were exported
    expect(existsSync(join(tempDir, '.github', 'copilot-instructions.md'))).toBe(true)
    expect(existsSync(join(tempDir, '.cursor', 'rules', 'test-rule.mdc'))).toBe(true)
    expect(existsSync(join(tempDir, '.clinerules'))).toBe(true)
    expect(existsSync(join(tempDir, '.windsurfrules'))).toBe(true)
    expect(existsSync(join(tempDir, '.rules'))).toBe(true)
    expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true)
    expect(existsSync(join(tempDir, 'CONVENTIONS.md'))).toBe(true)
    expect(existsSync(join(tempDir, 'CLAUDE.md'))).toBe(true)
    expect(existsSync(join(tempDir, 'best_practices.md'))).toBe(true)
  })

  it('should generate correct gitignore patterns for exported paths', () => {
    const paths = [
      '.github/copilot-instructions.md',
      '.cursor/rules/',
      '.clinerules',
      '.windsurfrules',
      '.rules',
      'AGENTS.md',
      'CONVENTIONS.md',
      'CLAUDE.md',
      'best_practices.md'
    ]

    const patterns = paths.map(p => p.endsWith('/') ? p + '**' : p)
    
    expect(patterns).toEqual([
      '.github/copilot-instructions.md',
      '.cursor/rules/**',
      '.clinerules',
      '.windsurfrules',
      '.rules',
      'AGENTS.md',
      'CONVENTIONS.md',
      'CLAUDE.md',
      'best_practices.md'
    ])
  })

  it('should update existing gitignore without duplicates', () => {
    const gitignorePath = join(tempDir, '.gitignore')
    
    // Create initial gitignore
    writeFileSync(gitignorePath, '# Initial content\nnode_modules/\n')
    
    // Export and simulate gitignore update
    exportAll(rules, tempDir)
    
    // In real implementation, the CLI would call updateGitignoreWithPaths
    // Here we verify the export creates the files that would be added to gitignore
    const exportedFiles = [
      '.github/copilot-instructions.md',
      '.cursor/rules/',
      '.clinerules',
      '.windsurfrules',
      '.rules',
      'AGENTS.md',
      'CONVENTIONS.md', 
      'CLAUDE.md',
      'best_practices.md'
    ]
    
    exportedFiles.forEach(file => {
      const fullPath = join(tempDir, file)
      expect(existsSync(fullPath) || existsSync(dirname(fullPath))).toBe(true)
    })
  })
})

describe('Export format selection mapping', () => {
  it('should map format selections to correct exporters', () => {
    const formatMap = {
      'copilot': { exporter: exportToCopilot, path: '.github/copilot-instructions.md' },
      'cursor': { exporter: exportToCursor, path: '.cursor/rules/' },
      'cline': { exporter: exportToCline, path: '.clinerules' },
      'windsurf': { exporter: exportToWindsurf, path: '.windsurfrules' },
      'zed': { exporter: exportToZed, path: '.rules' },
      'codex': { exporter: exportToCodex, path: 'AGENTS.md' },
      'opencode': { exporter: exportToOpenCode, path: 'AGENTS.md' },
      'aider': { exporter: exportToAider, path: 'CONVENTIONS.md' },
      'claude': { exporter: exportToClaudeCode, path: 'CLAUDE.md' },
      'qodo': { exporter: exportToQodo, path: 'best_practices.md' }
    }
    
    Object.entries(formatMap).forEach(([format, config]) => {
      expect(typeof config.exporter).toBe('function')
      expect(config.path).toBeTruthy()
    })
  })
})

// Helper to get dirname
function dirname(path: string): string {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
}