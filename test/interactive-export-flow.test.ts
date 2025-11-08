import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'

describe.skip('Interactive export flow', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'interactive-export-flow-'))
    
    // Create .agent directory with test rules
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })
    
    // Create a regular rule
    writeFileSync(join(agentDir, 'test-rule.md'), `---
id: test-rule
alwaysApply: true
---

# Test Rule

This is a test rule.`)
    
    // Create a conditional rule
    writeFileSync(join(agentDir, 'conditional-rule.md'), `---
id: conditional-rule
alwaysApply: false
scope: '**/*.ts'
---

# TypeScript Rule

TypeScript specific guidelines.`)
  })

  afterEach(async () => {
    // Wait a bit for file handles to be released on Windows
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    } catch (err) {
      // Ignore cleanup errors in tests
      console.warn(`Failed to clean up temp directory: ${tempDir}`)
    }
  })

  it('should export to selected format with interactive prompts', async () => {
    const cliPath = join(process.cwd(), 'dist', 'cli.js')
    
    // Use spawn to interact with the CLI
    const child = spawn('node', [cliPath, 'export', tempDir], {
      cwd: tempDir,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    let promptResponsed = false
    let gitignoreResponsed = false
    
    child.stdout.on('data', (data) => {
      output += data.toString()
      
      // Respond to prompts
      if (!promptResponsed && output.includes('Select an option')) {
        promptResponsed = true
        child.stdin.write('2\n')
      } else if (!gitignoreResponsed && output.includes('Add exported files to .gitignore?')) {
        gitignoreResponsed = true
        child.stdin.write('n\n')
      }
    })
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill()
        reject(new Error('Test timed out waiting for CLI process'))
      }, 10000)
      
      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve(code)
        else reject(new Error(`Process exited with code ${code}`))
      })
      child.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
    
    // Verify the output contains expected prompts and results
    expect(output).toContain('Select export format:')
    expect(output).toContain('VS Code Copilot (.github/copilot-instructions.md)')
    expect(output).toContain('Exported to:')
    
    // Verify the file was created
    const copilotPath = join(tempDir, '.github', 'copilot-instructions.md')
    expect(existsSync(copilotPath)).toBe(true)
    
    // Verify the content includes both rules and conditional section
    const content = readFileSync(copilotPath, 'utf-8')
    expect(content).toContain('# Test Rule')
    expect(content).toContain('## Context-Specific Rules')
    expect(content).toContain('When working with files matching `**/*.ts`')
    expect(content).toContain('# TypeScript Rule')
    
    // Verify gitignore was not created (since we declined)
    expect(existsSync(join(tempDir, '.gitignore'))).toBe(false)
  }, 15000)

  it('should export all formats when "All formats" is selected', async () => {
    const cliPath = join(process.cwd(), 'dist', 'cli.js')
    
    // Use spawn to interact with the CLI
    const child = spawn('node', [cliPath, 'export', tempDir], {
      cwd: tempDir,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    let promptResponsed = false
    let gitignoreResponsed = false
    
    child.stdout.on('data', (data) => {
      output += data.toString()
      
      // Respond to prompts
      if (!promptResponsed && output.includes('Select an option')) {
        promptResponsed = true
        child.stdin.write('1\n')
      } else if (!gitignoreResponsed && output.includes('Add exported files to .gitignore?')) {
        gitignoreResponsed = true
        child.stdin.write('y\n')
      }
    })
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill()
        reject(new Error('Test timed out waiting for CLI process'))
      }, 10000)
      
      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve(code)
        else reject(new Error(`Process exited with code ${code}`))
      })
      child.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
    
    // Verify all formats were exported
    expect(output).toContain('Exported to all formats')
    expect(output).toContain('Updated .gitignore')
    
    // Verify files were created
    expect(existsSync(join(tempDir, '.github', 'copilot-instructions.md'))).toBe(true)
    expect(existsSync(join(tempDir, '.cursor', 'rules', 'test-rule.mdc'))).toBe(true)
    expect(existsSync(join(tempDir, '.cursor', 'rules', 'conditional-rule.mdc'))).toBe(true)
    expect(existsSync(join(tempDir, '.clinerules'))).toBe(true)
    expect(existsSync(join(tempDir, '.windsurfrules'))).toBe(true)
    expect(existsSync(join(tempDir, '.rules'))).toBe(true)
    expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true)
    expect(existsSync(join(tempDir, 'CONVENTIONS.md'))).toBe(true)
    expect(existsSync(join(tempDir, 'CLAUDE.md'))).toBe(true)
    expect(existsSync(join(tempDir, 'best_practices.md'))).toBe(true)
    
    // Verify gitignore was created with correct patterns
    const gitignoreContent = readFileSync(join(tempDir, '.gitignore'), 'utf-8')
    expect(gitignoreContent).toContain('# Added by dotagent')
    expect(gitignoreContent).toContain('.github/copilot-instructions.md')
    expect(gitignoreContent).toContain('.cursor/rules/**')
    expect(gitignoreContent).toContain('.clinerules')
    expect(gitignoreContent).toContain('CLAUDE.md')
  }, 15000)

  it('should handle invalid input gracefully', async () => {
    const cliPath = join(process.cwd(), 'dist', 'cli.js')
    
    // Use spawn to interact with the CLI
    const child = spawn('node', [cliPath, 'export', tempDir], {
      cwd: tempDir,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    let promptResponsed = false
    let gitignoreResponsed = false
    
    child.stdout.on('data', (data) => {
      output += data.toString()
      
      // Respond to prompts
      if (!promptResponsed && output.includes('Select an option')) {
        promptResponsed = true
        child.stdin.write('99\n')
      } else if (!gitignoreResponsed && output.includes('Add exported files to .gitignore?')) {
        gitignoreResponsed = true
        child.stdin.write('n\n')
      }
    })
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill()
        reject(new Error('Test timed out waiting for CLI process'))
      }, 10000)
      
      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve(code)
        else reject(new Error(`Process exited with code ${code}`))
      })
      child.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
    
    expect(output).toContain('Invalid selection. Using default.')
    expect(output).toContain('Exported to all formats')
  }, 15000)
})