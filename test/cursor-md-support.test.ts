import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importCursor } from '../src/importers.js'
import { exportAll } from '../src/exporters.js'

describe('Cursor .md and .mdc support smoke tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cursor-smoke-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should import both .mdc and .md files from .cursor/rules directory', () => {
    // Create a .cursor/rules directory with both file types
    const rulesDir = join(tempDir, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })

    // Create .mdc file
    writeFileSync(join(rulesDir, 'typescript.mdc'), `---
id: ts-rules
scope: "**/*.ts"
alwaysApply: false
description: TypeScript coding standards
---

# TypeScript Rules

Use strict mode and proper typing.`)

    // Create .md file
    writeFileSync(join(rulesDir, 'react.md'), `---
id: react-patterns
scope: "**/*.tsx"
alwaysApply: false
description: React component patterns
---

# React Patterns

Use functional components with hooks.`)

    // Create a nested folder with mixed files
    const workflowsDir = join(rulesDir, 'workflows')
    mkdirSync(workflowsDir)
    
    writeFileSync(join(workflowsDir, 'pr-review.mdc'), `---
id: workflows/pr-review
description: Pull request review process
---

# PR Review Workflow

1. Check tests pass
2. Review code quality`)

    writeFileSync(join(workflowsDir, 'deployment.md'), `---
id: workflows/deployment
description: Deployment checklist
---

# Deployment Workflow

1. Run tests
2. Build production
3. Deploy`)

    // Import the rules
    const result = importCursor(rulesDir)

    // Verify all files were imported
    expect(result.rules).toHaveLength(4)
    expect(result.format).toBe('cursor')

    // Check that both .mdc and .md files were imported
    const ruleIds = result.rules.map(r => r.metadata.id).sort()
    expect(ruleIds).toEqual(['react-patterns', 'ts-rules', 'workflows/deployment', 'workflows/pr-review'])

    // Verify specific rule content
    const tsRule = result.rules.find(r => r.metadata.id === 'ts-rules')
    expect(tsRule?.metadata.scope).toBe('**/*.ts')
    expect(tsRule?.content).toContain('TypeScript Rules')

    const reactRule = result.rules.find(r => r.metadata.id === 'react-patterns')
    expect(reactRule?.metadata.scope).toBe('**/*.tsx')
    expect(reactRule?.content).toContain('React Patterns')
  })

  it('should handle private .md and .mdc files correctly', () => {
    const rulesDir = join(tempDir, '.cursor', 'rules')
    const privateDir = join(rulesDir, 'private')
    mkdirSync(privateDir, { recursive: true })

    // Create private files
    writeFileSync(join(rulesDir, 'api.local.mdc'), `---
id: api-private
---

# Private API Rules

Internal API guidelines.`)

    writeFileSync(join(privateDir, 'secrets.md'), `---
id: private/secrets
---

# Secret Management

How to handle secrets.`)

    const result = importCursor(rulesDir)

    expect(result.rules).toHaveLength(2)
    
    // Both should be marked as private
    expect(result.rules.every(r => r.metadata.private === true)).toBe(true)
  })

  it('should export conditional rules correctly with mixed .md/.mdc files', () => {
    // Create a complete project structure
    const rulesDir = join(tempDir, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })

    // General rule (always apply)
    writeFileSync(join(rulesDir, 'general.mdc'), `---
id: general-guidelines
alwaysApply: true
---

# General Guidelines

Follow clean code principles.`)

    // Conditional rules with scope
    writeFileSync(join(rulesDir, 'frontend.md'), `---
id: frontend-rules
scope: ["src/components/**", "src/pages/**"]
alwaysApply: false
description: Frontend development rules
---

# Frontend Rules

Component guidelines.`)

    // Workflow folder
    const workflowsDir = join(rulesDir, 'workflows')
    mkdirSync(workflowsDir)
    
    writeFileSync(join(workflowsDir, 'testing.md'), `---
id: workflows/testing
alwaysApply: false
description: Testing workflow
---

# Testing Workflow

How to write tests.`)

    // Import and export
    const imported = importCursor(rulesDir)
    const copilotPath = join(tempDir, '.github', 'copilot-instructions.md')
    
    exportAll(imported.rules, tempDir, false)
    
    // Read the exported copilot file
    const copilotContent = readFileSync(copilotPath, 'utf-8')

    // Verify general rules are in main content
    expect(copilotContent).toContain('# General Guidelines')
    expect(copilotContent).toContain('Follow clean code principles.')

    // Verify conditional rules section exists
    expect(copilotContent).toContain('## Context-Specific Rules')
    
    // Verify scope-based rules
    expect(copilotContent).toContain('When working with files matching `src/components/**`, also apply:')
    expect(copilotContent).toContain('→ [frontend-rules](.agent/frontend-rules.md) - Frontend development rules')

    // Verify workflows section
    expect(copilotContent).toContain('## Workflows')
    expect(copilotContent).toContain('→ [workflows/testing](.agent/workflows/testing.md) - Testing workflow')

    // Conditional content should not be in main section
    expect(copilotContent.indexOf('# Frontend Rules')).toBe(-1)
    expect(copilotContent.indexOf('# Testing Workflow')).toBe(-1)
  })

  it('should handle edge cases with .md files', () => {
    const rulesDir = join(tempDir, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })

    // File with numeric prefix
    writeFileSync(join(rulesDir, '001-setup.md'), `---
id: setup-guide
---

# Setup Guide

Initial setup instructions.`)

    // File with .local in the name
    writeFileSync(join(rulesDir, 'database.local.md'), `---
id: db-config
---

# Database Config

Local database settings.`)

    // Deeply nested file
    const deepDir = join(rulesDir, 'backend', 'api', 'v2')
    mkdirSync(deepDir, { recursive: true })
    
    writeFileSync(join(deepDir, 'endpoints.mdc'), `---
id: backend/api/v2/endpoints
scope: "src/api/v2/**"
---

# API v2 Endpoints

Endpoint documentation.`)

    const result = importCursor(rulesDir)

    expect(result.rules).toHaveLength(3)

    // Check ID processing removed numeric prefix
    const setupRule = result.rules.find(r => r.metadata.id === 'setup-guide')
    expect(setupRule).toBeDefined()

    // Check private flag for .local file
    const dbRule = result.rules.find(r => r.metadata.id === 'db-config')
    expect(dbRule?.metadata.private).toBe(true)

    // Check nested folder handling
    const apiRule = result.rules.find(r => r.metadata.id === 'backend/api/v2/endpoints')
    expect(apiRule).toBeDefined()
    expect(apiRule?.metadata.scope).toBe('src/api/v2/**')
  })
})