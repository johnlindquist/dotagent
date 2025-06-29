import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importCursor } from '../src/importers.js'

describe('Cursor import from all subdirectories', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cursor-all-dirs-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should import files from .cursor/workflows directory', () => {
    // Create .cursor/workflows directory structure
    const cursorDir = join(tempDir, '.cursor')
    const workflowsDir = join(cursorDir, 'workflows')
    mkdirSync(workflowsDir, { recursive: true })

    // Create workflow files
    writeFileSync(join(workflowsDir, 'pr-review.md'), `---
id: workflows/pr-review
description: Pull request review workflow
---

# PR Review Workflow

Steps for reviewing PRs.`)

    writeFileSync(join(workflowsDir, 'deployment.mdc'), `---
id: workflows/deployment
alwaysApply: false
---

# Deployment Workflow

Deployment checklist.`)

    const result = importCursor(cursorDir)

    expect(result.rules).toHaveLength(2)
    expect(result.format).toBe('cursor')

    const ruleIds = result.rules.map(r => r.metadata.id).sort()
    expect(ruleIds).toEqual(['workflows/deployment', 'workflows/pr-review'])

    const prRule = result.rules.find(r => r.metadata.id === 'workflows/pr-review')
    expect(prRule?.content).toContain('PR Review Workflow')
  })

  it('should import from multiple .cursor subdirectories', () => {
    const cursorDir = join(tempDir, '.cursor')
    const rulesDir = join(cursorDir, 'rules')
    const workflowsDir = join(cursorDir, 'workflows')
    const componentsDir = join(cursorDir, 'components')
    
    mkdirSync(rulesDir, { recursive: true })
    mkdirSync(workflowsDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    // Rules directory
    writeFileSync(join(rulesDir, 'general.mdc'), `---
id: general
alwaysApply: true
---

General rules.`)

    // Workflows directory
    writeFileSync(join(workflowsDir, 'testing.md'), `---
id: workflows/testing
---

Testing workflow.`)

    // Components directory
    writeFileSync(join(componentsDir, 'react.md'), `---
id: components/react
scope: "**/*.tsx"
---

React component patterns.`)

    // Nested structure
    const nestedDir = join(componentsDir, 'hooks')
    mkdirSync(nestedDir)
    
    writeFileSync(join(nestedDir, 'use-state.md'), `---
id: components/hooks/use-state
---

useState best practices.`)

    const result = importCursor(cursorDir)

    expect(result.rules).toHaveLength(4)
    
    const ruleIds = result.rules.map(r => r.metadata.id).sort()
    expect(ruleIds).toEqual([
      'components/hooks/use-state',
      'components/react',
      'general',
      'workflows/testing'
    ])

    // Verify a specific rule
    const reactRule = result.rules.find(r => r.metadata.id === 'components/react')
    expect(reactRule?.metadata.scope).toBe('**/*.tsx')
  })

  it('should handle directory without rules subdirectory', () => {
    const cursorDir = join(tempDir, '.cursor')
    mkdirSync(cursorDir, { recursive: true })

    // Put files directly in .cursor
    writeFileSync(join(cursorDir, 'root-rule.md'), `---
id: root-rule
---

Root level rule.`)

    // Also create a workflows directory
    const workflowsDir = join(cursorDir, 'workflows')
    mkdirSync(workflowsDir)
    
    writeFileSync(join(workflowsDir, 'workflow.mdc'), `---
id: workflows/workflow
---

Workflow content.`)

    const result = importCursor(cursorDir)

    expect(result.rules).toHaveLength(2)
    
    const ruleIds = result.rules.map(r => r.metadata.id)
    expect(ruleIds).toContain('root-rule')
    expect(ruleIds).toContain('workflows/workflow')
  })

  it('should handle complex nested structures', () => {
    const cursorDir = join(tempDir, '.cursor')
    const paths = [
      'rules/frontend/components',
      'rules/backend/api',
      'workflows/ci-cd',
      'templates/react',
      'snippets/typescript'
    ]

    // Create all directories
    paths.forEach(path => {
      mkdirSync(join(cursorDir, path), { recursive: true })
    })

    // Add files in various locations
    writeFileSync(join(cursorDir, 'rules/frontend/components/button.md'), `---
id: rules/frontend/components/button
---

Button component rules.`)

    writeFileSync(join(cursorDir, 'rules/backend/api/rest.mdc'), `---
id: rules/backend/api/rest
---

REST API guidelines.`)

    writeFileSync(join(cursorDir, 'workflows/ci-cd/github-actions.md'), `---
id: workflows/ci-cd/github-actions
---

GitHub Actions workflow.`)

    writeFileSync(join(cursorDir, 'templates/react/component.md'), `---
id: templates/react/component
---

React component template.`)

    writeFileSync(join(cursorDir, 'snippets/typescript/types.mdc'), `---
id: snippets/typescript/types
---

TypeScript type utilities.`)

    const result = importCursor(cursorDir)

    expect(result.rules).toHaveLength(5)
    
    const ruleIds = result.rules.map(r => r.metadata.id).sort()
    expect(ruleIds).toEqual([
      'rules/backend/api/rest',
      'rules/frontend/components/button',
      'snippets/typescript/types',
      'templates/react/component',
      'workflows/ci-cd/github-actions'
    ])
  })

  it('should skip non-.md/.mdc files', () => {
    const cursorDir = join(tempDir, '.cursor')
    const workflowsDir = join(cursorDir, 'workflows')
    mkdirSync(workflowsDir, { recursive: true })

    // Create various file types
    writeFileSync(join(workflowsDir, 'valid.md'), `---
id: valid
---

Valid content.`)

    writeFileSync(join(workflowsDir, 'also-valid.mdc'), `---
id: also-valid
---

Also valid.`)

    // These should be ignored
    writeFileSync(join(workflowsDir, 'README.txt'), 'This is a text file')
    writeFileSync(join(workflowsDir, 'config.json'), '{"key": "value"}')
    writeFileSync(join(workflowsDir, 'script.js'), 'console.log("hello")')

    const result = importCursor(cursorDir)

    expect(result.rules).toHaveLength(2)
    
    const ruleIds = result.rules.map(r => r.metadata.id).sort()
    expect(ruleIds).toEqual(['also-valid', 'valid'])
  })
})