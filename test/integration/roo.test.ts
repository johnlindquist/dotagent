import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importAll, exportToRoo } from '../../src/index.js'
import { parse } from 'path'
import type { RuleBlock } from '../../src/types.js'

describe('Roo Code Integration Tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dotagent-roo-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('imports .roo/rules/*.md files with frontmatter and private rules', async () => {
    // Create .roo/rules directory structure
    const rulesDir = join(tempDir, '.roo', 'rules')
    const nestedDir = join(rulesDir, 'nested')
    
    // Public rule with frontmatter
    writeFileSync(join(rulesDir, 'public-rule.md'), `---
id: public-rule
alwaysApply: true
description: Public coding standard
---
# Public Rule Content
Always use TypeScript strict mode.`)

    // Private rule by filename
    writeFileSync(join(rulesDir, 'private.local.md'), `---
id: private-rule
description: Private preference
---
# Private Rule Content
Prefer tabs over spaces.`)

    // Nested rule with frontmatter
    writeFileSync(join(nestedDir, '001-nested.md'), `---
id: nested/rule
scope: src/nested/**
priority: high
---
# Nested Rule Content
Follow nested patterns.`)

    // Rule with explicit private: true
    writeFileSync(join(rulesDir, 'explicit-private.md'), `---
id: explicit-private
private: true
---
# Explicit Private Content
Sensitive information.`)

    const { results, errors } = await importAll(tempDir)

    expect(errors).toHaveLength(0)

    const rooResult = results.find(r => r.format === 'roo')
    expect(rooResult).toBeDefined()
    expect(rooResult!.rules).toHaveLength(4)

    // Check public rule
    const publicRule = rooResult!.rules.find(r => r.metadata.id === 'public-rule')
    expect(publicRule).toBeDefined()
    expect(publicRule!.metadata.alwaysApply).toBe(true)
    expect(publicRule!.metadata.private).toBeUndefined()
    expect(publicRule!.content).toContain('Always use TypeScript strict mode')

    // Check private by filename
    const privateByFile = rooResult!.rules.find(r => r.metadata.id === 'private-rule')
    expect(privateByFile).toBeDefined()
    expect(privateByFile!.metadata.private).toBe(true)

    // Check nested
    const nestedRule = rooResult!.rules.find(r => r.metadata.id === 'nested/rule')
    expect(nestedRule).toBeDefined()
    expect(nestedRule!.metadata.scope).toBe('src/nested/**')

    // Check explicit private
    const explicitPrivate = rooResult!.rules.find(r => r.metadata.id === 'explicit-private')
    expect(explicitPrivate).toBeDefined()
    expect(explicitPrivate!.metadata.private).toBe(true)
  })

  it('exports rules to .roo/rules preserving frontmatter and structure', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'exported-public',
          alwaysApply: true,
          description: 'Exported public rule'
        },
        content: '# Exported Public Content\nFollow best practices.'
      },
      {
        metadata: {
          id: 'private/exported',
          private: true,
          scope: 'private/**'
        },
        content: '# Private Exported Content\nInternal only.'
      },
      {
        metadata: {
          id: 'nested/exported',
          priority: 'high'
        },
        content: '# Nested Exported Content\nHigh priority rules.'
      }
    ]

    exportToRoo(rules, tempDir)

    const outputRulesDir = join(tempDir, '.roo', 'rules')
    expect(readdirSync(outputRulesDir)).toContain('exported-public.md')

    // Check public file
    const publicContent = readFileSync(join(outputRulesDir, 'exported-public.md'), 'utf-8')
    expect(publicContent).toMatch(/^---\n.*alwaysApply: true\n.*description: Exported public rule\n---\n\n# Exported Public Content/)
    expect(publicContent).toContain('Follow best practices.')

    // Check nested private
    const privateDir = join(outputRulesDir, 'private')
    expect(readdirSync(privateDir)).toContain('exported.md')
    const privateContent = readFileSync(join(privateDir, 'exported.md'), 'utf-8')
    expect(privateContent).toMatch(/private: true/)
    expect(privateContent).toContain('Internal only.')

    // Check nested public
    const nestedDir = join(outputRulesDir, 'nested')
    expect(readdirSync(nestedDir)).toContain('exported.md')
    const nestedContent = readFileSync(join(nestedDir, 'exported.md'), 'utf-8')
    expect(nestedContent).toMatch(/priority: high/)
    expect(nestedContent).toContain('High priority rules.')
  })

  it('roundtrip: import from .roo/rules and export back preserves metadata', async () => {
    // Setup input .roo/rules
    const inputRulesDir = join(tempDir, '.roo', 'rules')
    writeFileSync(join(inputRulesDir, 'roundtrip.md'), `---
id: roundtrip-test
alwaysApply: false
scope: ['src/**', 'test/**']
description: Roundtrip test rule
priority: medium
---
# Roundtrip Content
This should be preserved after import/export.`)

    // Import
    const { results } = await importAll(tempDir)
    const rooResult = results.find(r => r.format === 'roo')
    expect(rooResult!.rules).toHaveLength(1)

    const importedRule = rooResult!.rules[0]
    expect(importedRule.metadata.id).toBe('roundtrip-test')
    expect(importedRule.metadata.alwaysApply).toBe(false)
    expect(importedRule.metadata.scope).toEqual(['src/**', 'test/**'])
    expect(importedRule.metadata.description).toBe('Roundtrip test rule')
    expect(importedRule.metadata.priority).toBe('medium')

    // Export back to new location
    const outputDir = join(tempDir, 'output')
    exportToRoo([importedRule], outputDir)

    const outputFile = join(outputDir, '.roo', 'rules', 'roundtrip-test.md')
    const exportedContent = readFileSync(outputFile, 'utf-8')

    // Verify frontmatter preserved
    expect(exportedContent).toMatch(/^---\n.*alwaysApply: false\n.*scope:\n  - src\/\*\*/)
    expect(exportedContent).toMatch(/description: Roundtrip test rule/)
    expect(exportedContent).toMatch(/priority: medium/)
    expect(exportedContent).toContain('# Roundtrip Content')
    expect(exportedContent).toContain('This should be preserved after import/export.')
  })

  it('CLI export to roo format creates correct structure', async () => {
    // Note: This is a smoke test; full CLI integration might require spawning process
    // For now, test the underlying export function used by CLI

    const rules: RuleBlock[] = [
      {
        metadata: { id: 'cli-test', alwaysApply: true },
        content: '# CLI Test Content'
      }
    ]

    // Simulate CLI output dir
    const cliOutputDir = join(tempDir, 'cli-output')
    exportToRoo(rules, cliOutputDir)

    const rooDir = join(cliOutputDir, '.roo', 'rules')
    expect(readdirSync(rooDir)).toContain('cli-test.md')

    const content = readFileSync(join(rooDir, 'cli-test.md'), 'utf-8')
    expect(content).toMatch(/^---\n.*alwaysApply: true\n---\n\n# CLI Test Content/)
  })

  it('handles private rules correctly in export (excludes by default)', () => {
    const rules: RuleBlock[] = [
      {
        metadata: { id: 'public', alwaysApply: true },
        content: '# Public'
      },
      {
        metadata: { id: 'private', private: true },
        content: '# Private'
      }
    ]

    exportToRoo(rules, tempDir)

    const rulesDir = join(tempDir, '.roo', 'rules')
    expect(readdirSync(rulesDir)).toContain('public.md')
    expect(readdirSync(rulesDir)).not.toContain('private.md')

    // With includePrivate
    const outputDir2 = join(tempDir, 'with-private')
    exportToRoo(rules, outputDir2, { includePrivate: true })

    const rulesDir2 = join(outputDir2, '.roo', 'rules')
    expect(readdirSync(rulesDir2)).toContain('public.md')
    expect(readdirSync(rulesDir2)).toContain('private.md')

    const privateContent = readFileSync(join(rulesDir2, 'private.md'), 'utf-8')
    expect(privateContent).toMatch(/private: true/)
  })
})