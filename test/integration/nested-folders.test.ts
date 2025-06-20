import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importAgent, exportToAgent } from '../../src/index.js'
import type { RuleBlock } from '../../src/types.js'

describe('Nested folder support', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-nested-test-'))
  })

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should import rules from nested folders', () => {
    // Create nested folder structure
    const agentDir = join(tempDir, '.agent')
    const apiDir = join(agentDir, 'api')
    const authDir = join(apiDir, 'auth')
    const componentsDir = join(agentDir, 'frontend', 'components')
    
    mkdirSync(authDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    // Create rules in nested folders
    writeFileSync(join(agentDir, 'root-rule.md'), `---
id: root-rule
---

# Root Rule
This is at the root level.`)

    writeFileSync(join(apiDir, 'api-general.md'), `---
id: api-general
scope: src/api/**
---

# API General Rules
General API guidelines.`)

    writeFileSync(join(authDir, 'auth-rules.md'), `---
id: auth-rules
priority: high
---

# Authentication Rules
Auth specific rules.`)

    writeFileSync(join(componentsDir, 'component-standards.md'), `---
id: component-standards
scope: src/components/**
---

# Component Standards
React component guidelines.`)

    // Import the rules
    const result = importAgent(agentDir)

    expect(result.rules).toHaveLength(4)
    expect(result.format).toBe('agent')

    // Check that all rules were imported
    const ruleIds = result.rules.map(r => r.metadata.id).sort()
    expect(ruleIds).toEqual(['api-general', 'auth-rules', 'component-standards', 'root-rule'])

    // Verify specific rule content
    const authRule = result.rules.find(r => r.metadata.id === 'auth-rules')
    expect(authRule?.metadata.priority).toBe('high')
    expect(authRule?.content).toContain('Authentication Rules')
  })

  it('should export rules to nested folders based on ID', () => {
    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'root-config',
          alwaysApply: true
        },
        content: '# Root Configuration\n\nRoot level config.'
      },
      {
        metadata: {
          id: 'api/endpoints',
          scope: 'src/api/**'
        },
        content: '# API Endpoints\n\nAPI endpoint rules.'
      },
      {
        metadata: {
          id: 'api/auth/jwt',
          priority: 'high' as const
        },
        content: '# JWT Rules\n\nJWT authentication rules.'
      },
      {
        metadata: {
          id: 'frontend/components/buttons',
          scope: 'src/components/buttons/**'
        },
        content: '# Button Components\n\nButton component guidelines.'
      }
    ]

    // Export the rules
    exportToAgent(rules, tempDir)

    // Verify the file structure (without numeric prefixes)
    const agentDir = join(tempDir, '.agent')
    expect(existsSync(join(agentDir, 'root-config.md'))).toBe(true)
    expect(existsSync(join(agentDir, 'api', 'endpoints.md'))).toBe(true)
    expect(existsSync(join(agentDir, 'api', 'auth', 'jwt.md'))).toBe(true)
    expect(existsSync(join(agentDir, 'frontend', 'components', 'buttons.md'))).toBe(true)

    // Verify file contents
    const jwtContent = readFileSync(join(agentDir, 'api', 'auth', 'jwt.md'), 'utf8')
    expect(jwtContent).toContain('priority: high')
    expect(jwtContent).toContain('JWT authentication rules')
  })

  it('should handle ID generation for nested files without explicit IDs', () => {
    // Create nested structure without explicit IDs in frontmatter
    const agentDir = join(tempDir, '.agent')
    const deepDir = join(agentDir, 'docs', 'api', 'v2')
    
    mkdirSync(deepDir, { recursive: true })

    writeFileSync(join(deepDir, 'overview.md'), `---
description: API v2 Overview
---

# API v2 Overview
Documentation for API version 2.`)

    const result = importAgent(agentDir)

    expect(result.rules).toHaveLength(1)
    // ID should be generated from path: docs/api/v2/overview.md -> docs/api/v2/overview
    expect(result.rules[0].metadata.id).toBe('docs/api/v2/overview')
    expect(result.rules[0].metadata.description).toBe('API v2 Overview')
  })

  it('should handle round-trip with nested folders', () => {
    const originalRules: RuleBlock[] = [
      {
        metadata: {
          id: 'testing/unit/setup',
          description: 'Unit test setup'
        },
        content: '# Unit Test Setup\n\nHow to set up unit tests.'
      },
      {
        metadata: {
          id: 'testing/e2e/playwright',
          description: 'Playwright E2E tests'
        },
        content: '# Playwright Tests\n\nE2E testing with Playwright.'
      }
    ]

    // Export
    exportToAgent(originalRules, tempDir)

    // Re-import
    const reimported = importAgent(join(tempDir, '.agent'))

    expect(reimported.rules).toHaveLength(2)
    
    // Sort for consistent comparison
    const sortedOriginal = [...originalRules].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id))
    const sortedReimported = [...reimported.rules].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id))

    // Compare rules
    sortedOriginal.forEach((original, index) => {
      const reimportedRule = sortedReimported[index]
      expect(reimportedRule.metadata.id).toBe(original.metadata.id)
      expect(reimportedRule.metadata.description).toBe(original.metadata.description)
      expect(reimportedRule.content.trim()).toBe(original.content.trim())
    })
  })

  it('should ignore non-markdown files in nested folders', () => {
    const agentDir = join(tempDir, '.agent')
    const subDir = join(agentDir, 'config')
    
    mkdirSync(subDir, { recursive: true })

    // Create various file types
    writeFileSync(join(agentDir, 'rule.md'), '---\nid: rule\n---\n# Rule')
    writeFileSync(join(agentDir, 'README.txt'), 'This should be ignored')
    writeFileSync(join(subDir, 'config.json'), '{"ignore": "this"}')
    writeFileSync(join(subDir, 'settings.md'), '---\nid: settings\n---\n# Settings')
    writeFileSync(join(subDir, '.DS_Store'), 'ignore')

    const result = importAgent(agentDir)

    // Should only import the .md files
    expect(result.rules).toHaveLength(2)
    const ids = result.rules.map(r => r.metadata.id).sort()
    expect(ids).toEqual(['rule', 'settings'])
  })
})