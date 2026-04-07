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

  it('should export to Claude Code with always-apply in CLAUDE.md and scoped in .claude/rules/', () => {
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

    // Export to Claude Code format
    exportToClaudeCode(result.rules, tempDir)

    // Verify CLAUDE.md has always-apply rules
    const claudeContent = readFileSync(join(tempDir, 'CLAUDE.md'), 'utf-8')
    expect(claudeContent).toContain('# Code Style Guidelines')
    expect(claudeContent).toContain('Use 2 spaces for indentation')
    expect(claudeContent).toContain('# Git Workflow')
    expect(claudeContent).toContain('Write clear commit messages')

    // Verify CLAUDE.md does NOT contain conditional rules content
    expect(claudeContent).not.toContain('# TypeScript Rules')
    expect(claudeContent).not.toContain('# React Component Guidelines')
    expect(claudeContent).not.toContain('# Database Best Practices')
    expect(claudeContent).not.toContain('# PR Review Checklist')

    // Verify scoped rules are in .claude/rules/
    const rulesDir = join(tempDir, '.claude', 'rules')
    expect(existsSync(join(rulesDir, 'typescript.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'react-components.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'database.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'workflows', 'pr-review.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'workflows', 'deployment.md'))).toBe(true)

    // Verify frontmatter in scoped rule files
    const tsContent = readFileSync(join(rulesDir, 'typescript.md'), 'utf-8')
    expect(tsContent).toContain('description: TypeScript specific rules')
    expect(tsContent).toContain('alwaysApply: false')
    expect(tsContent).toContain('**/*.ts')
    expect(tsContent).toContain('Use strict mode')

    const reactContent = readFileSync(join(rulesDir, 'react-components.md'), 'utf-8')
    expect(reactContent).toContain('description: React component guidelines')
    expect(reactContent).toContain('**/*.tsx')
    expect(reactContent).toContain('**/components/**')
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

  it('should handle complex real-world scenario with multiple rule types via exportAll', () => {
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

    // Import and export all
    const result = importAgent(agentDir)
    exportAll(result.rules, tempDir, false)

    // Check CLAUDE.md has always-apply content only
    const claudePath = join(tempDir, 'CLAUDE.md')
    expect(existsSync(claudePath)).toBe(true)
    const claudeContent = readFileSync(claudePath, 'utf-8')
    expect(claudeContent).toContain('# Project Standards')
    expect(claudeContent).not.toContain('# React Patterns')
    expect(claudeContent).not.toContain('# API Design')

    // Check scoped rules in .claude/rules/
    const rulesDir = join(tempDir, '.claude', 'rules')
    expect(existsSync(join(rulesDir, 'frontend', 'react-patterns.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'frontend', 'styling.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'backend', 'api-design.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'backend', 'security.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'testing', 'unit-tests.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'workflows', 'code-review.md'))).toBe(true)
    expect(existsSync(join(rulesDir, 'workflows', 'release.md'))).toBe(true)

    // Verify Copilot still uses single-file conditional section
    const copilotPath = join(tempDir, '.github', 'copilot-instructions.md')
    const copilotContent = readFileSync(copilotPath, 'utf-8')
    expect(copilotContent).toContain('## Context-Specific Rules')
    expect(copilotContent).toContain('When working with files matching')
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
    exportToClaudeCode(result.rules, tempDir)

    // No always-apply rules, so no CLAUDE.md
    expect(existsSync(join(tempDir, 'CLAUDE.md'))).toBe(false)

    // All scoped rules should be in .claude/rules/
    const rulesDir = join(tempDir, '.claude', 'rules')

    const noDescContent = readFileSync(join(rulesDir, 'no-description.md'), 'utf-8')
    expect(noDescContent).toContain('**/*.go')
    expect(noDescContent).toContain('alwaysApply: false')

    const helpersContent = readFileSync(join(rulesDir, 'utils', 'helpers.md'), 'utf-8')
    expect(helpersContent).toContain('src/utils/**')
    expect(helpersContent).toContain('description: Utility function guidelines')

    const loggingContent = readFileSync(join(rulesDir, 'utils', 'logging.md'), 'utf-8')
    expect(loggingContent).toContain('description: Logging best practices')
    expect(loggingContent).toContain('alwaysApply: false')
  })
})
