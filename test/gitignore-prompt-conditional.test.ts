import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

describe('Gitignore prompt conditional behavior', () => {
  let tempDir: string
  let agentDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gitignore-prompt-test-'))
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
        env: { ...process.env, NODE_ENV: 'test' } // Set NODE_ENV to 'test' to avoid prompts
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

  it('should not update gitignore when all exported files are already in gitignore', () => {
    // Create a gitignore file with the pattern we're about to export
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, `# Pre-existing content
node_modules/

# Added by dotagent: ignore exported AI rule files
.github/copilot-instructions.md
`)
    
    // Get the initial gitignore content
    const initialContent = readFileSync(gitignorePath, 'utf-8')

    const result = runDotAgentExport(['--format', 'copilot'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was NOT updated (content should be the same)
    const finalContent = readFileSync(gitignorePath, 'utf-8')
    expect(finalContent).toBe(initialContent)
    
    // Should still indicate export was successful
    expect(result.stdout).toContain('Exported to:')
    // Should NOT indicate gitignore was updated
    expect(result.stdout).not.toContain('Updated .gitignore')
  })

  it('should update gitignore when exported files are not in gitignore', () => {
    // Create a gitignore file without the pattern we're about to export
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, `# Pre-existing content
node_modules/
`)
    
    // Get the initial gitignore content
    const initialContent = readFileSync(gitignorePath, 'utf-8')

    const result = runDotAgentExport(['--format', 'copilot'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was updated (content should be different)
    const finalContent = readFileSync(gitignorePath, 'utf-8')
    expect(finalContent).not.toBe(initialContent)
    expect(finalContent).toContain('.github/copilot-instructions.md')
    
    // Should indicate export was successful and gitignore was updated
    expect(result.stdout).toContain('Exported to:')
    expect(result.stdout).toContain('Updated .gitignore')
  })

  it('should update gitignore when gitignore does not exist', () => {
    // Don't create a gitignore file
    
    const result = runDotAgentExport(['--format', 'copilot'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was created
    const gitignorePath = join(tempDir, '.gitignore')
    expect(existsSync(gitignorePath)).toBe(true)
    
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8')
    expect(gitignoreContent).toContain('.github/copilot-instructions.md')
    
    // Should indicate export was successful and gitignore was updated
    expect(result.stdout).toContain('Exported to:')
    expect(result.stdout).toContain('Updated .gitignore')
  })

  it('should not update gitignore with --no-gitignore flag even when there are new patterns', () => {
    // Don't create a gitignore file (so all patterns would be new)
    
    const result = runDotAgentExport(['--format', 'copilot', '--no-gitignore'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was NOT created
    const gitignorePath = join(tempDir, '.gitignore')
    expect(existsSync(gitignorePath)).toBe(false)
    
    // Should indicate export was successful but NOT that gitignore was updated
    expect(result.stdout).toContain('Exported to:')
    expect(result.stdout).not.toContain('Updated .gitignore')
  })

  it('should update gitignore with --gitignore flag even when all patterns already exist', () => {
    // Create a gitignore file with the pattern we're about to export
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, `# Pre-existing content
node_modules/

# Added by dotagent: ignore exported AI rule files
.github/copilot-instructions.md
`)
    
    // Get the initial gitignore content
    const initialContent = readFileSync(gitignorePath, 'utf-8')

    const result = runDotAgentExport(['--format', 'copilot', '--gitignore'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was NOT updated (content should be the same)
    const finalContent = readFileSync(gitignorePath, 'utf-8')
    expect(finalContent).toBe(initialContent)
    
    // Should indicate auto-update
    expect(result.stdout).toContain('Updating .gitignore (auto-enabled by --gitignore flag)')
    // But should NOT indicate it was actually updated since no new patterns were added
    expect(result.stdout).not.toContain('Updated .gitignore')
  })

  it('should not update gitignore when exporting to multiple formats but all patterns already exist', () => {
    // Create a gitignore file with all the patterns we're about to export
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, `# Pre-existing content
node_modules/

# Added by dotagent: ignore exported AI rule files
.github/copilot-instructions.md
.cursor/rules/**
.clinerules
.windsurfrules
.rules
AGENTS.md
CONVENTIONS.md
CLAUDE.md
GEMINI.md
best_practices.md
`)
    
    // Get the initial gitignore content
    const initialContent = readFileSync(gitignorePath, 'utf-8')

    const result = runDotAgentExport(['--formats', 'copilot,cline,claude'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was NOT updated (content should be the same)
    const finalContent = readFileSync(gitignorePath, 'utf-8')
    expect(finalContent).toBe(initialContent)
    
    // Should indicate export was successful but NOT that gitignore was updated
    expect(result.stdout).toContain('Exported to:')
    expect(result.stdout).not.toContain('Updated .gitignore')
  })

  it('should update gitignore when exporting to multiple formats and some patterns are new', () => {
    // Create a gitignore file with only some of the patterns we're about to export
    const gitignorePath = join(tempDir, '.gitignore')
    writeFileSync(gitignorePath, `# Pre-existing content
node_modules/

# Added by dotagent: ignore exported AI rule files
.github/copilot-instructions.md
.clinerules
`)
    
    // Get the initial gitignore content
    const initialContent = readFileSync(gitignorePath, 'utf-8')

    const result = runDotAgentExport(['--formats', 'copilot,cline,claude'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was updated (content should be different)
    const finalContent = readFileSync(gitignorePath, 'utf-8')
    expect(finalContent).not.toBe(initialContent)
    expect(finalContent).toContain('CLAUDE.md')
    
    // Should indicate export was successful and gitignore was updated
    expect(result.stdout).toContain('Exported to:')
    expect(result.stdout).toContain('Updated .gitignore')
  })
})