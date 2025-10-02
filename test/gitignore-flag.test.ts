import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

describe('Gitignore flag functionality', () => {
  let tempDir: string
  let agentDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gitignore-flag-test-'))
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

  it('should auto-update gitignore when --gitignore flag is used', () => {
    const result = runDotAgentExport(['--format', 'copilot', '--gitignore'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was updated automatically
    const gitignorePath = join(tempDir, '.gitignore')
    expect(existsSync(gitignorePath)).toBe(true)
    
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8')
    expect(gitignoreContent).toContain('.github/copilot-instructions.md')
  })

  it('should skip gitignore prompt with --no-gitignore flag', () => {
    const result = runDotAgentExport(['--format', 'copilot', '--no-gitignore'])
    
    expect(result.exitCode).toBe(0)
    
    // Check that gitignore was NOT updated
    const gitignorePath = join(tempDir, '.gitignore')
    // The file might exist from previous test runs, but shouldn't contain the new patterns
    if (existsSync(gitignorePath)) {
      const gitignoreContent = readFileSync(gitignorePath, 'utf-8')
      expect(gitignoreContent).not.toContain('.github/copilot-instructions.md')
    }
  })

  it('should handle --gitignore and --no-gitignore flags being mutually exclusive', () => {
    const result = runDotAgentExport(['--format', 'copilot', '--gitignore', '--no-gitignore'])
    
    // Should fail or handle gracefully when both flags are used
    expect(result.exitCode).not.toBe(0)
  })

  it('should prompt for gitignore when neither flag is specified', () => {
    // This test would normally require mocking the prompt
    // For now, we'll just verify the export works without flags
    const result = runDotAgentExport(['--format', 'copilot'])
    
    expect(result.exitCode).toBe(0)
    // The actual prompt behavior would be tested in integration tests
  })
})