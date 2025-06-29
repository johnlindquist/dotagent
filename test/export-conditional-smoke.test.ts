import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importAgent } from '../src/importers.js'
import { exportAll, exportToClaudeCode, exportToCopilot, exportToWindsurf, exportToAider, exportToCodex } from '../src/exporters.js'

describe('Conditional export smoke tests for single-file formats', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'export-conditional-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should export to CLAUDE.md with conditional rules section', () => {
    // Create a realistic .agent directory structure
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })

    // General rules (always apply)
    writeFileSync(join(agentDir, 'code-style.md'), `---
id: code-style
alwaysApply: true
description: General code style guidelines
---

# Code Style Guidelines

- Use 2 spaces for indentation
- Always use semicolons
- Prefer const over let`)

    writeFileSync(join(agentDir, 'git-workflow.md'), `---
id: git-workflow
alwaysApply: true
description: Git workflow practices
---

# Git Workflow

- Write clear commit messages
- Use feature branches
- Squash commits before merging`)

    // TypeScript specific rules (conditional)
    writeFileSync(join(agentDir, 'typescript.md'), `---
id: typescript
alwaysApply: false
scope: "**/*.ts"
description: TypeScript specific rules
---

# TypeScript Rules

- Use strict mode
- Define explicit return types
- Avoid any type`)

    // React component rules (conditional with multiple scopes)
    writeFileSync(join(agentDir, 'react-components.md'), `---
id: react-components
alwaysApply: false
scope: ["**/*.tsx", "**/components/**"]
description: React component guidelines
---

# React Component Guidelines

- Use functional components
- Implement proper error boundaries
- Follow hooks rules`)

    // Database rules (conditional by description)
    writeFileSync(join(agentDir, 'database.md'), `---
id: database
alwaysApply: false
description: database operations, SQL queries, and data modeling
---

# Database Best Practices

- Use parameterized queries
- Implement connection pooling
- Add proper indexes`)

    // Create workflows directory
    const workflowsDir = join(agentDir, 'workflows')
    mkdirSync(workflowsDir)

    writeFileSync(join(workflowsDir, 'pr-review.md'), `---
id: workflows/pr-review
alwaysApply: false
description: Pull request review checklist
---

# PR Review Checklist

- [ ] Tests pass
- [ ] Code follows style guide
- [ ] Documentation updated`)

    writeFileSync(join(workflowsDir, 'deployment.md'), `---
id: workflows/deployment
alwaysApply: false
description: Deployment process
---

# Deployment Process

1. Run tests
2. Build production bundle
3. Deploy to staging
4. Verify
5. Deploy to production`)

    // Import all rules
    const result = importAgent(agentDir)
    
    // Export to CLAUDE.md
    const claudePath = join(tempDir, 'CLAUDE.md')
    exportToClaudeCode(result.rules, claudePath)
    
    const content = readFileSync(claudePath, 'utf-8')
    
    // Verify always-apply rules are in the main content
    expect(content).toContain('# Code Style Guidelines')
    expect(content).toContain('Use 2 spaces for indentation')
    expect(content).toContain('# Git Workflow')
    expect(content).toContain('Write clear commit messages')
    
    // Verify conditional rules section exists
    expect(content).toContain('## Context-Specific Rules')
    
    // Verify scope-based rules
    expect(content).toContain('When working with files matching `**/*.ts`, also apply:')
    expect(content).toContain('→ [typescript](.agent/typescript.md) - TypeScript specific rules')
    
    expect(content).toContain('When working with files matching `**/*.tsx`, also apply:')
    expect(content).toContain('→ [react-components](.agent/react-components.md) - React component guidelines')
    
    // Verify description-based rules
    expect(content).toContain('When working with database operations, SQL queries, and data modeling, also apply:')
    expect(content).toContain('→ [database](.agent/database.md)')
    
    // Verify workflows section
    expect(content).toContain('## Workflows')
    expect(content).toContain('→ [workflows/pr-review](.agent/workflows/pr-review.md) - Pull request review checklist')
    expect(content).toContain('→ [workflows/deployment](.agent/workflows/deployment.md) - Deployment process')
    
    // Verify conditional content is NOT in the main section
    expect(content.indexOf('# TypeScript Rules')).toBe(-1)
    expect(content.indexOf('# React Component Guidelines')).toBe(-1)
    expect(content.indexOf('# Database Best Practices')).toBe(-1)
    expect(content.indexOf('# PR Review Checklist')).toBe(-1)
  })

  it('should export to different single-file formats with correct separators', () => {
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })

    // Create a mix of always-apply and conditional rules
    writeFileSync(join(agentDir, 'main.md'), `---
id: main-rules
alwaysApply: true
---

# Main Rules

Always follow these guidelines.`)

    writeFileSync(join(agentDir, 'testing.md'), `---
id: testing
alwaysApply: false
scope: "**/*.test.{js,ts}"
description: Testing guidelines
---

# Testing Guidelines

Write comprehensive tests.`)

    const result = importAgent(agentDir)
    
    // Test different export formats
    const formats = [
      { 
        path: join(tempDir, '.github', 'copilot-instructions.md'),
        exporter: exportToCopilot,
        separator: '---'
      },
      {
        path: join(tempDir, '.windsurfrules'),
        exporter: exportToWindsurf,
        separator: null // No separator for Windsurf
      },
      {
        path: join(tempDir, 'CONVENTIONS.md'),
        exporter: exportToAider,
        separator: null
      },
      {
        path: join(tempDir, 'AGENTS.md'),
        exporter: exportToCodex,
        separator: null
      }
    ]
    
    formats.forEach(({ path, exporter, separator }) => {
      exporter(result.rules, path)
      const content = readFileSync(path, 'utf-8')
      
      // All should have main content
      expect(content).toContain('# Main Rules')
      expect(content).toContain('Always follow these guidelines.')
      
      // All should have conditional section
      expect(content).toContain('## Context-Specific Rules')
      expect(content).toContain('When working with files matching `**/*.test.{js,ts}`, also apply:')
      expect(content).toContain('→ [testing](.agent/testing.md) - Testing guidelines')
      
      // Check separator if applicable
      if (separator) {
        expect(content).toContain(`\n\n${separator}\n\n## Context-Specific Rules`)
      }
      
      // Conditional content should not be in main section
      expect(content.indexOf('# Testing Guidelines')).toBe(-1)
    })
  })

  it('should handle complex real-world scenario with multiple rule types', () => {
    const agentDir = join(tempDir, '.agent')
    const dirs = {
      frontend: join(agentDir, 'frontend'),
      backend: join(agentDir, 'backend'),
      workflows: join(agentDir, 'workflows'),
      testing: join(agentDir, 'testing')
    }
    
    // Create all directories
    Object.values(dirs).forEach(dir => mkdirSync(dir, { recursive: true }))

    // Always-apply rules
    writeFileSync(join(agentDir, 'project-standards.md'), `---
id: project-standards
alwaysApply: true
priority: high
---

# Project Standards

Core principles that apply to all code.`)

    // Frontend rules with scope
    writeFileSync(join(dirs.frontend, 'react-patterns.md'), `---
id: frontend/react-patterns
alwaysApply: false
scope: ["src/components/**/*.tsx", "src/pages/**/*.tsx"]
description: React best practices
---

# React Patterns

Component patterns and best practices.`)

    writeFileSync(join(dirs.frontend, 'styling.md'), `---
id: frontend/styling
alwaysApply: false
scope: "**/*.{css,scss}"
description: CSS and styling guidelines
---

# Styling Guidelines

CSS architecture and conventions.`)

    // Backend rules with mixed conditions
    writeFileSync(join(dirs.backend, 'api-design.md'), `---
id: backend/api-design
alwaysApply: false
scope: "src/api/**/*.ts"
description: REST API design principles
---

# API Design

RESTful API conventions.`)

    writeFileSync(join(dirs.backend, 'security.md'), `---
id: backend/security
alwaysApply: false
description: security, authentication, and authorization
---

# Security Guidelines

Security best practices.`)

    // Testing rules
    writeFileSync(join(dirs.testing, 'unit-tests.md'), `---
id: testing/unit-tests
alwaysApply: false
scope: "**/*.test.ts"
description: Unit testing standards
---

# Unit Testing

How to write good unit tests.`)

    // Workflow rules (no scope, just in workflows folder)
    writeFileSync(join(dirs.workflows, 'code-review.md'), `---
id: workflows/code-review
alwaysApply: false
description: Code review process
---

# Code Review Process

Steps for reviewing code.`)

    writeFileSync(join(dirs.workflows, 'release.md'), `---
id: workflows/release
alwaysApply: false
description: Release management
---

# Release Process

How to cut a release.`)

    // Import and export
    const result = importAgent(agentDir)
    exportAll(result.rules, tempDir, false)
    
    // Check CLAUDE.md
    const claudePath = join(tempDir, 'CLAUDE.md')
    expect(existsSync(claudePath)).toBe(true)
    const claudeContent = readFileSync(claudePath, 'utf-8')
    
    // Verify structure
    const sections = claudeContent.split('\n## ')
    
    // Should have main content, Context-Specific Rules, and Workflows
    expect(sections.length).toBeGreaterThanOrEqual(3)
    
    // Check main content
    expect(claudeContent).toContain('# Project Standards')
    
    // Check Context-Specific Rules section exists and has correct content
    const contextSection = sections.find(s => s.startsWith('Context-Specific Rules'))
    expect(contextSection).toBeDefined()
    
    // Frontend rules
    expect(contextSection).toContain('When working with files matching `src/components/**/*.tsx`, also apply:')
    expect(contextSection).toContain('→ [frontend/react-patterns](.agent/frontend/react-patterns.md) - React best practices')
    expect(contextSection).toContain('When working with files matching `**/*.{css,scss}`, also apply:')
    expect(contextSection).toContain('→ [frontend/styling](.agent/frontend/styling.md) - CSS and styling guidelines')
    
    // Backend rules
    expect(contextSection).toContain('When working with files matching `src/api/**/*.ts`, also apply:')
    expect(contextSection).toContain('→ [backend/api-design](.agent/backend/api-design.md) - REST API design principles')
    
    // Testing rules
    expect(contextSection).toContain('When working with files matching `**/*.test.ts`, also apply:')
    expect(contextSection).toContain('→ [testing/unit-tests](.agent/testing/unit-tests.md) - Unit testing standards')
    
    // Check Workflows section
    const workflowsSection = sections.find(s => s.startsWith('Workflows'))
    expect(workflowsSection).toBeDefined()
    expect(workflowsSection).toContain('→ [workflows/code-review](.agent/workflows/code-review.md) - Code review process')
    expect(workflowsSection).toContain('→ [workflows/release](.agent/workflows/release.md) - Release management')
    
    // Check Backend section (for backend/security which has no scope)
    const backendSection = sections.find(s => s.startsWith('Backend'))
    expect(backendSection).toBeDefined()
    expect(backendSection).toContain('→ [backend/security](.agent/backend/security.md) - security, authentication, and authorization')
    
    // Verify no conditional content in main section
    const mainContent = sections[0] // Content before first ##
    expect(mainContent).not.toContain('# React Patterns')
    expect(mainContent).not.toContain('# API Design')
    expect(mainContent).not.toContain('# Code Review Process')
  })

  it('should handle edge cases gracefully', () => {
    const agentDir = join(tempDir, '.agent')
    mkdirSync(agentDir, { recursive: true })

    // Rule with no description (should not appear in description section)
    writeFileSync(join(agentDir, 'no-desc.md'), `---
id: no-description
alwaysApply: false
scope: "**/*.go"
---

# Go Rules

Go language specifics.`)

    // Rule in folder but with scope (should appear in scope section, not folder section)
    const utilsDir = join(agentDir, 'utils')
    mkdirSync(utilsDir)
    
    writeFileSync(join(utilsDir, 'helpers.md'), `---
id: utils/helpers
alwaysApply: false
scope: "src/utils/**"
description: Utility function guidelines
---

# Utility Guidelines

How to write utilities.`)

    // Rule with both scope and in a folder without scope
    writeFileSync(join(utilsDir, 'logging.md'), `---
id: utils/logging
alwaysApply: false
description: Logging best practices
---

# Logging

How to implement logging.`)

    const result = importAgent(agentDir)
    const claudePath = join(tempDir, 'CLAUDE.md')
    exportToClaudeCode(result.rules, claudePath)
    
    const content = readFileSync(claudePath, 'utf-8')
    
    // Should have Context-Specific Rules
    expect(content).toContain('## Context-Specific Rules')
    
    // no-description should be in scope section only
    expect(content).toContain('When working with files matching `**/*.go`, also apply:')
    expect(content).toContain('→ [no-description](.agent/no-description.md)')
    
    // utils/helpers should be in scope section (not Utils section)
    expect(content).toContain('When working with files matching `src/utils/**`, also apply:')
    expect(content).toContain('→ [utils/helpers](.agent/utils/helpers.md) - Utility function guidelines')
    
    // utils/logging should be in Utils section
    expect(content).toContain('## Utils')
    expect(content).toContain('→ [utils/logging](.agent/utils/logging.md) - Logging best practices')
  })
})