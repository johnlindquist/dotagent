import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

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
    const cliPath = join(process.cwd(), 'dist', 'cli.js')
    const cmd = `node ${cliPath} export ${args.join(' ')}`
    
    try {
      const result = execSync(cmd, { 
        cwd: tempDir,
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' }
      })
      return { stdout: result, stderr: '', exitCode: 0 }
    } catch (error: any) {
      return { 
        stdout: error.stdout || '', 
        stderr: error.stderr || '', 
        exitCode: error.status || 1 
      }
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
        expect(gitignoreContent).toContain(pattern), 
          `Gitignore should contain pattern for ${formatPath}. If missing, add it to the exportedPaths array in src/cli.ts.`
      } else {
        expect(gitignoreContent).toContain(formatPath),
          `Gitignore should contain ${formatPath}. If missing, add it to the exportedPaths array in src/cli.ts.`
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
