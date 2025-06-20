import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importAgent, exportToAgent, exportToCopilot, exportToCursor } from '../src/index.js'
import type { RuleBlock, ExportOptions } from '../src/types.js'

describe('Private rules support', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-private-test-'))
  })

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should detect private rules by filename pattern', () => {
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })

    // Create public rule
    writeFileSync(join(agentDir, 'public-rule.md'), `---
id: public-rule
---

# Public Rule
This is a public rule.`)

    // Create private rule with .local.md suffix
    writeFileSync(join(agentDir, 'private-rule.local.md'), `---
id: private-rule
---

# Private Rule
This is a private rule.`)

    // Create private rule in private directory
    const privateDir = join(agentDir, 'private')
    mkdirSync(privateDir)
    writeFileSync(join(privateDir, 'secret-rule.md'), `---
id: secret-rule
---

# Secret Rule
This is a secret rule.`)

    const result = importAgent(agentDir)

    expect(result.rules).toHaveLength(3)
    
    const publicRule = result.rules.find(r => r.metadata.id === 'public-rule')
    const privateRule = result.rules.find(r => r.metadata.id === 'private-rule')
    const secretRule = result.rules.find(r => r.metadata.id === 'secret-rule')

    expect(publicRule?.metadata.private).toBeUndefined()
    expect(privateRule?.metadata.private).toBe(true)
    expect(secretRule?.metadata.private).toBe(true)
  })

  it('should respect frontmatter private flag over filename', () => {
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })

    // Create rule marked as private in frontmatter (but with public filename)
    writeFileSync(join(agentDir, 'marked-private.md'), `---
id: marked-private
private: true
---

# Marked Private
This rule is marked private in frontmatter.`)

    // Create rule with private filename but marked as public in frontmatter
    writeFileSync(join(agentDir, 'override.local.md'), `---
id: override
private: false
---

# Override Rule
This has a private filename but is marked public.`)

    const result = importAgent(agentDir)

    const markedPrivate = result.rules.find(r => r.metadata.id === 'marked-private')
    const override = result.rules.find(r => r.metadata.id === 'override')

    expect(markedPrivate?.metadata.private).toBe(true)
    expect(override?.metadata.private).toBe(false)
  })

  it('should filter out private rules during export by default', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public-1',
          alwaysApply: true
        },
        content: '# Public Rule 1'
      },
      {
        metadata: {
          id: 'private-1',
          private: true,
          alwaysApply: true
        },
        content: '# Private Rule 1'
      },
      {
        metadata: {
          id: 'public-2',
          alwaysApply: true
        },
        content: '# Public Rule 2'
      }
    ]

    const copilotPath = join(tempDir, 'copilot-instructions.md')
    exportToCopilot(rules, copilotPath)

    const content = readFileSync(copilotPath, 'utf8')
    
    // Should only contain public rules
    expect(content).toContain('Public Rule 1')
    expect(content).toContain('Public Rule 2')
    expect(content).not.toContain('Private Rule 1')
  })

  it('should include private rules when includePrivate option is set', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public',
          alwaysApply: true
        },
        content: '# Public Rule'
      },
      {
        metadata: {
          id: 'private',
          private: true,
          alwaysApply: true
        },
        content: '# Private Rule'
      }
    ]

    const copilotPath = join(tempDir, 'copilot-with-private.md')
    const options: ExportOptions = { includePrivate: true }
    exportToCopilot(rules, copilotPath, options)

    const content = readFileSync(copilotPath, 'utf8')
    
    // Should contain both public and private rules
    expect(content).toContain('Public Rule')
    expect(content).toContain('Private Rule')
  })

  it('should handle nested private directories in Cursor format', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'api/public',
          description: 'Public API rules'
        },
        content: '# Public API Rules'
      },
      {
        metadata: {
          id: 'api/private/auth',
          private: true,
          description: 'Private auth rules'
        },
        content: '# Private Auth Rules'
      }
    ]

    exportToCursor(rules, tempDir)

    const cursorDir = join(tempDir, '.cursor', 'rules')
    const publicFile = join(cursorDir, 'api/public.mdc')
    const privateFile = join(cursorDir, 'api/private/auth.mdc')

    // Public rule should be exported
    expect(existsSync(publicFile)).toBe(true)
    
    // Private rule should not be exported by default
    expect(existsSync(privateFile)).toBe(false)

    // Now export with includePrivate
    exportToCursor(rules, tempDir, { includePrivate: true })
    expect(existsSync(privateFile)).toBe(true)
  })

  it('should round-trip private rules correctly', () => {
    const originalRules: RuleBlock[] = [
      {
        metadata: {
          id: 'test/public',
          description: 'Public test rule'
        },
        content: '# Public Test'
      },
      {
        metadata: {
          id: 'test/private',
          description: 'Private test rule',
          private: true
        },
        content: '# Private Test'
      }
    ]

    // Export to .agent directory
    exportToAgent(originalRules, tempDir)

    // Re-import
    const reimported = importAgent(join(tempDir, '.agent'))

    expect(reimported.rules).toHaveLength(2)
    
    const publicRule = reimported.rules.find(r => r.metadata.id === 'test/public')
    const privateRule = reimported.rules.find(r => r.metadata.id === 'test/private')

    expect(publicRule?.metadata.private).toBeUndefined()
    expect(privateRule?.metadata.private).toBe(true)
  })

  it('should handle .local file naming for various formats', () => {
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })

    // Test various local file patterns
    const testFiles = [
      'config.local.md',
      'settings.LOCAL.md', // Case insensitive
      'rules.md.local', // Should NOT be treated as private
    ]

    testFiles.forEach((filename, index) => {
      writeFileSync(join(agentDir, filename), `---
id: test-${index}
---

Test content ${index}`)
    })

    const result = importAgent(agentDir)

    const localRule1 = result.rules.find(r => r.metadata.id === 'test-0')
    const localRule2 = result.rules.find(r => r.metadata.id === 'test-1')
    const nonLocalRule = result.rules.find(r => r.metadata.id === 'test-2')

    expect(localRule1?.metadata.private).toBe(true)
    expect(localRule2?.metadata.private).toBe(true) // Case insensitive
    expect(nonLocalRule?.metadata.private).toBeUndefined() // .md.local is not a valid pattern
  })
})