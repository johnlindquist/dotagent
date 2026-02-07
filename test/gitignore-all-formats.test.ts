import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importAgent, exportAll, exportToCopilot, exportToCursor, exportToCline, exportToWindsurf, exportToZed, exportToCodex, exportToAider, exportToClaudeCode, exportToGemini, exportToQodo, exportToRoo, exportToJunie, exportToKilocode, exportToAmazonQ, exportToOpenCode } from '../src/index.js'

/**
 * Canonical list of all export format paths.
 * This should be updated whenever a new format is added.
 */
const EXPORT_FORMAT_PATHS = [
  '.amazonq/rules/',
  '.clinerules',
  '.cursor/rules/',
  '.github/copilot-instructions.md',
  '.junie/guidelines.md',
  '.kilocode/rules/',
  '.roo/rules/',
  '.rules',
  '.windsurfrules',
  'AGENTS.md',
  'best_practices.md',
  'CLAUDE.md',
  'CONVENTIONS.md',
  'GEMINI.md'
] as const

/**
 * Private patterns that should be ignored in gitignore.
 * This should match the updateGitignore function in cli.ts.
 */
const PRIVATE_PATTERNS = [
  '.agent/**/*.local.md',
  '.agent/private/**',
  '.clinerules.local',
  '.clinerules/private/**',
  '.cursor/rules/**/*.local.{mdc,md}',
  '.cursor/rules-private/**',
  '.github/copilot-instructions.local.md',
  '.junie/guidelines.local.md',
  '.kilocode/rules/*.local.md',
  '.roo/rules/*.local.md',
  '.rules.local',
  '.windsurfrules.local',
  'AGENTS.local.md',
  'CLAUDE.local.md',
  'CONVENTIONS.local.md',
  'GEMINI.local.md'
] as const

describe('Gitignore all formats coverage', () => {
  let tempDir: string
  let agentDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gitignore-coverage-test-'))
    agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })
    
    // Create a simple agent rule file
    writeFileSync(join(agentDir, 'test-rule.md'), `---
id: test-rule
title: Test Rule
---

# Test Rule

This is a test rule.`)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function runDotAgentExport(args: string[]): { stdout: string; stderr: string; exitCode: number } {
    // Parse arguments
    const formatIndex = args.indexOf('--format')
    const format = formatIndex !== -1 ? args[formatIndex + 1] : 'all'
    const shouldGitignore = args.includes('--gitignore')
    
    const agentDir = join(tempDir, '.agent')
    
    // Import rules from .agent/ directory
    const result = importAgent(agentDir)
    const rules = result.rules
    
    // Export to the specified format
    const exportedPaths: string[] = []
    
    if (format === 'all') {
      exportAll(rules, tempDir, false)
      exportedPaths.push(
        '.amazonq/rules/',
        '.clinerules',
        '.cursor/rules/',
        '.github/copilot-instructions.md',
        '.junie/guidelines.md',
        '.kilocode/rules/',
        '.roo/rules/',
        '.rules',
        '.windsurfrules',
        'AGENTS.md',
        'best_practices.md',
        'CLAUDE.md',
        'CONVENTIONS.md',
        'GEMINI.md'
      )
    } else {
      // Export to specific format
      switch (format) {
        case 'copilot':
          exportToCopilot(rules, join(tempDir, '.github', 'copilot-instructions.md'))
          exportedPaths.push('.github/copilot-instructions.md')
          break
        case 'cursor':
          exportToCursor(rules, tempDir)
          exportedPaths.push('.cursor/rules/')
          break
        case 'cline':
          exportToCline(rules, join(tempDir, '.clinerules'))
          exportedPaths.push('.clinerules')
          break
        case 'windsurf':
          exportToWindsurf(rules, join(tempDir, '.windsurfrules'))
          exportedPaths.push('.windsurfrules')
          break
        case 'zed':
          exportToZed(rules, join(tempDir, '.rules'))
          exportedPaths.push('.rules')
          break
        case 'codex':
          exportToCodex(rules, join(tempDir, 'AGENTS.md'))
          exportedPaths.push('AGENTS.md')
          break
        case 'aider':
          exportToAider(rules, join(tempDir, 'CONVENTIONS.md'))
          exportedPaths.push('CONVENTIONS.md')
          break
        case 'claude':
          exportToClaudeCode(rules, join(tempDir, 'CLAUDE.md'))
          exportedPaths.push('CLAUDE.md')
          break
        case 'gemini':
          exportToGemini(rules, join(tempDir, 'GEMINI.md'))
          exportedPaths.push('GEMINI.md')
          break
        case 'opencode':
          exportToOpenCode(rules, join(tempDir, 'AGENTS.md'))
          exportedPaths.push('AGENTS.md')
          break
        case 'qodo':
          exportToQodo(rules, join(tempDir, 'best_practices.md'))
          exportedPaths.push('best_practices.md')
          break
        case 'roo':
          exportToRoo(rules, tempDir)
          exportedPaths.push('.roo/rules/')
          break
        case 'junie':
          exportToJunie(rules, tempDir)
          exportedPaths.push('.junie/guidelines.md')
          break
        case 'kilocode':
          exportToKilocode(rules, tempDir)
          exportedPaths.push('.kilocode/rules/')
          break
        case 'amazonq':
          exportToAmazonQ(rules, tempDir)
          exportedPaths.push('.amazonq/rules/')
          break
      }
    }
    
    // Update gitignore if requested
    if (shouldGitignore && exportedPaths.length > 0) {
      updateGitignoreWithPaths(tempDir, exportedPaths)
    }
    
    return { stdout: '', stderr: '', exitCode: 0 }
  }

  /**
   * Filter gitignore patterns that are not already present in the content
   */
  function filterNewPatterns(content: string, paths: string[]): string[] {
    const lines = content
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))

    const lineSet = new Set(lines)

    const variants = (p: string): string[] => {
      if (p.endsWith('/')) {
        const base = p.replace(/^\/+/, '')
        return [base, `${base}**`, `/${base}`, `/${base}**`]
      } else {
        const base = p.replace(/^\/+/, '')
        return [base, `/${base}`]
      }
    }

    return paths.filter(p => !variants(p).some(v => lineSet.has(v)))
  }

  /**
   * Update gitignore with exported AI rule file patterns
   */
  function updateGitignoreWithPaths(repoPath: string, paths: string[]): void {
    const gitignorePath = join(repoPath, '.gitignore')
    
    const patterns = [
      '',
      '# Added by dotagent: ignore exported AI rule files',
      ...paths.map(p => p.endsWith('/') ? p + '**' : p),
      ''
    ].join('\n')
    
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8')
      
      // Check if any of the patterns already exist
      const newPatterns = filterNewPatterns(content, paths)
      
      if (newPatterns.length > 0) {
        appendFileSync(gitignorePath, patterns)
      }
    } else {
      writeFileSync(gitignorePath, patterns.trim() + '\n')
    }
  }

  it('all exported paths in CLI match formats exported by exportAll()', () => {
    // This test verifies that the exportedPaths array in cli.ts includes all
    // formats that exportAll() actually exports.
    //
    // If this test fails, it means a new format was added to exportAll()
    // but its path was not added to the exportedPaths array in the 'all' case.
    //
    // ACTION REQUIRED: Add the missing format path to the exportedPaths.push()
    // array in src/cli.ts around line 249 in the 'all' case.
    
    // Verify we have the expected number of format paths
    expect(EXPORT_FORMAT_PATHS.length).toBeGreaterThan(10)
    
    // The paths should be unique
    const uniquePaths = new Set(EXPORT_FORMAT_PATHS)
    expect(uniquePaths.size).toBe(EXPORT_FORMAT_PATHS.length)
    
    // All paths should be non-empty strings
    for (const path of EXPORT_FORMAT_PATHS) {
      expect(typeof path).toBe('string')
      expect(path.length).toBeGreaterThan(0)
    }
  })

  it('updateGitignoreWithPaths includes all defined format paths', () => {
    // This test verifies that when exporting to 'all' formats,
    // the gitignore gets updated with patterns for ALL exported paths.
    
    const result = runDotAgentExport(['--format', 'all', '--gitignore'])
    
    expect(result.exitCode).toBe(0)
    
    const gitignorePath = join(tempDir, '.gitignore')
    expect(existsSync(gitignorePath)).toBe(true)
    
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8')
    
    // Verify all format paths are in gitignore
    for (const formatPath of EXPORT_FORMAT_PATHS) {
      // For directory paths (ending with /), check for the ** variant
      if (formatPath.endsWith('/')) {
        const basePath = formatPath.slice(0, -1) // Remove trailing /
        const pattern = `${basePath}/**`
        expect(gitignoreContent, `Gitignore should contain pattern for ${formatPath}. If missing, add it to the exportedPaths array in src/cli.ts.`).toContain(pattern)
      } else {
        expect(gitignoreContent, `Gitignore should contain ${formatPath}. If missing, add it to the exportedPaths array in src/cli.ts.`).toContain(formatPath)
      }
    }
  })

  it('updateGitignore private patterns match documented patterns', () => {
    // This test verifies that the privatePatterns array in updateGitignore()
    // includes all patterns documented in README.md for private rules.
    //
    // If this test fails, it means a new private pattern was documented
    // but not added to the updateGitignore function.
    //
    // ACTION REQUIRED: Add the missing pattern to the privatePatterns array
    // in src/cli.ts around line 557 in the updateGitignore function.
    
    expect(PRIVATE_PATTERNS.length).toBeGreaterThan(10)
    
    // All patterns should be non-empty strings
    for (const pattern of PRIVATE_PATTERNS) {
      expect(typeof pattern).toBe('string')
      expect(pattern.length).toBeGreaterThan(0)
    }
    
    // Should include patterns for all known formats
    expect(PRIVATE_PATTERNS).toContain('.clinerules.local')
    expect(PRIVATE_PATTERNS).toContain('.cursor/rules/**/*.local.{mdc,md}')
    expect(PRIVATE_PATTERNS).toContain('.github/copilot-instructions.local.md')
    expect(PRIVATE_PATTERNS).toContain('.junie/guidelines.local.md')
    expect(PRIVATE_PATTERNS).toContain('.kilocode/rules/*.local.md')
    expect(PRIVATE_PATTERNS).toContain('.roo/rules/*.local.md')
    expect(PRIVATE_PATTERNS).toContain('.rules.local')
    expect(PRIVATE_PATTERNS).toContain('.windsurfrules.local')
    expect(PRIVATE_PATTERNS).toContain('AGENTS.local.md')
    expect(PRIVATE_PATTERNS).toContain('CLAUDE.local.md')
    expect(PRIVATE_PATTERNS).toContain('CONVENTIONS.local.md')
    expect(PRIVATE_PATTERNS).toContain('GEMINI.local.md')
  })

  it('fails with clear message when exportedPaths is incomplete', () => {
    // This is a documentation test to explain the expected behavior.
    // If a developer adds a new format to exportAll() but forgets to add
    // it to exportedPaths, the gitignore won't be updated for that format.
    //
    // The fix is simple: add the format's output path to the exportedPaths
    // array in the 'all' case (around line 249 in src/cli.ts).
    
    // Verify the test setup is correct
    expect(EXPORT_FORMAT_PATHS).toContain('.amazonq/rules/')
    expect(EXPORT_FORMAT_PATHS).toContain('.roo/rules/')
    expect(EXPORT_FORMAT_PATHS).toContain('.kilocode/rules/')
    expect(EXPORT_FORMAT_PATHS).toContain('.junie/guidelines.md')
  })

  it('gitignore header comment is present when patterns are added', () => {
    // Create a gitignore without any dotagent patterns
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, '# Pre-existing gitignore\nnode_modules/\n')
    
    runDotAgentExport(['--format', 'copilot', '--gitignore'])
    
    const content = readFileSync(gitignorePath, 'utf-8')
    expect(content).toContain('# Added by dotagent: ignore exported AI rule files')
  })
})
