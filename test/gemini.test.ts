import { describe, it, expect } from 'vitest'
import { importGemini, exportToGemini } from '../src/index.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src/types.js'

describe('Gemini CLI format', () => {
  it('should import GEMINI.md file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'gemini-test-'))
    const geminiPath = join(tempDir, 'GEMINI.md')
    
    const content = `# Project Context

This project is a Python FastAPI application with SQLAlchemy.

## Coding Standards

- Use type hints for all function parameters and returns
- Follow PEP 8 style guidelines
- All functions must have docstrings

## Common Commands

\`\`\`bash
uvicorn main:app --reload  # Start development server
pytest                     # Run tests
python -m pip install -e . # Install in development mode
\`\`\`

## Architecture Notes

The app uses SQLAlchemy for ORM and Pydantic for data validation.`

    writeFileSync(geminiPath, content, 'utf8')

    try {
      const result = importGemini(geminiPath)

      expect(result.format).toBe('gemini')
      expect(result.filePath).toBe(geminiPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('gemini-instructions')
      expect(result.rules[0].metadata.alwaysApply).toBe(true)
      expect(result.rules[0].content).toContain('Project Context')
      expect(result.rules[0].content).toContain('uvicorn main:app')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export to GEMINI.md format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'gemini-export-'))
    const geminiPath = join(tempDir, 'GEMINI.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'project-setup',
          description: 'Project Setup Instructions',
          alwaysApply: true
        },
        content: `## Environment Setup

Use Python 3.11+ and Poetry for dependency management.

### Required Tools
- Poetry
- Python 3.11+
- pytest`
      },
      {
        metadata: {
          id: 'code-style',
          description: 'Code Style Guidelines'
        },
        content: `## Formatting

- 4 space indentation
- Double quotes for strings
- Type hints required`
      }
    ]

    try {
      exportToGemini(rules, geminiPath)

      const exported = readFileSync(geminiPath, 'utf8')
      
      // Should include headers from descriptions
      expect(exported).toContain('# Project Setup Instructions')
      expect(exported).toContain('# Code Style Guidelines')
      
      // Should include content
      expect(exported).toContain('Use Python 3.11+ and Poetry')
      expect(exported).toContain('4 space indentation')
      
      // Should separate rules with double newlines
      expect(exported.split('\n\n').length).toBeGreaterThan(2)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle rules without descriptions', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'gemini-nodesc-'))
    const geminiPath = join(tempDir, 'GEMINI.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'basic-rule',
          alwaysApply: true
        },
        content: 'Always use type hints'
      }
    ]

    try {
      exportToGemini(rules, geminiPath)

      const exported = readFileSync(geminiPath, 'utf8')
      
      // Should not have a header if no description
      expect(exported).not.toContain('#')
      expect(exported.trim()).toBe('Always use type hints')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should preserve content formatting during import/export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'gemini-preserve-'))
    const geminiPath = join(tempDir, 'GEMINI.md')
    
    const originalContent = `# Development Guidelines

## Code Structure

\`\`\`
src/
  models/
  routes/
  schemas/
\`\`\`

### Important Notes

1. Always validate request data
2. Handle exceptions gracefully
3. Write tests for all endpoints

> Remember: Explicit is better than implicit`

    writeFileSync(geminiPath, originalContent, 'utf8')

    try {
      // Import
      const imported = importGemini(geminiPath)
      
      // Export to a different location
      const exportPath = join(tempDir, 'GEMINI-exported.md')
      exportToGemini(imported.rules, exportPath)
      
      const exported = readFileSync(exportPath, 'utf8')
      
      // The content should be preserved (with added header)
      expect(exported).toContain('# Gemini CLI context and instructions')
      expect(exported).toContain('Always validate request data')
      expect(exported).toContain('Explicit is better than implicit')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle private GEMINI.local.md files', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'gemini-private-'))
    const geminiLocalPath = join(tempDir, 'GEMINI.local.md')
    
    const content = `# Private Development Settings

## API Keys

Use environment variables for sensitive data.

## Local Configuration

Development server runs on port 8000.`

    writeFileSync(geminiLocalPath, content, 'utf8')

    try {
      const result = importGemini(geminiLocalPath)

      expect(result.format).toBe('gemini')
      expect(result.filePath).toBe(geminiLocalPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.private).toBe(true)
      expect(result.rules[0].content).toContain('API Keys')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})