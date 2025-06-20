import { describe, it, expect } from 'vitest'
import { importQodo, exportToQodo } from '../src/index.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src/types.js'

describe('Qodo best practices format', () => {
  it('should import best_practices.md file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qodo-test-'))
    const bestPracticesPath = join(tempDir, 'best_practices.md')
    
    const content = `# Coding Standards

## General Guidelines

- Use TypeScript for all new code
- Follow ESLint rules strictly
- Write comprehensive tests for all features

## Code Structure

### File Organization
- Group related files in directories
- Use index.ts files for clean imports
- Keep components small and focused

### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes and components
- Use UPPER_SNAKE_CASE for constants

## Best Practices

### Error Handling
- Always handle errors explicitly
- Use custom error types when appropriate
- Log errors with sufficient context

### Performance
- Avoid unnecessary re-renders in React
- Use lazy loading for large components
- Optimize database queries

## Code Examples

### Good Example
\`\`\`typescript
interface User {
  id: string
  name: string
  email: string
}

const fetchUser = async (id: string): Promise<User> => {
  try {
    const response = await api.get(\`/users/\${id}\`)
    return response.data
  } catch (error) {
    logger.error('Failed to fetch user', { id, error })
    throw new UserFetchError(\`Failed to fetch user \${id}\`)
  }
}
\`\`\`

### Bad Example
\`\`\`typescript
const getUser = (id) => {
  return fetch('/users/' + id).then(r => r.json())
}
\`\`\``

    writeFileSync(bestPracticesPath, content, 'utf8')

    try {
      const result = importQodo(bestPracticesPath)

      expect(result.format).toBe('qodo')
      expect(result.filePath).toBe(bestPracticesPath)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('qodo-best-practices')
      expect(result.rules[0].metadata.alwaysApply).toBe(true)
      expect(result.rules[0].metadata.description).toBe('Qodo best practices and coding standards')
      expect(result.rules[0].metadata.scope).toBe('**/*')
      expect(result.rules[0].metadata.priority).toBe('high')
      expect(result.rules[0].content).toContain('Coding Standards')
      expect(result.rules[0].content).toContain('Use TypeScript for all new code')
      expect(result.rules[0].content).toContain('fetchUser')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export to best_practices.md format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qodo-export-'))
    const bestPracticesPath = join(tempDir, 'best_practices.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'code-quality',
          description: 'Code Quality Standards',
          alwaysApply: true,
          priority: 'high'
        },
        content: `## Code Quality

- Write clean, readable code
- Use meaningful variable names
- Keep functions small and focused
- Add comments for complex logic`
      },
      {
        metadata: {
          id: 'testing-practices',
          description: 'Testing Best Practices'
        },
        content: `## Testing Guidelines

- Write unit tests for all functions
- Use integration tests for API endpoints
- Mock external dependencies
- Aim for 80%+ code coverage`
      }
    ]

    try {
      exportToQodo(rules, bestPracticesPath)

      const exported = readFileSync(bestPracticesPath, 'utf8')
      
      // Should include headers from descriptions
      expect(exported).toContain('# Code Quality Standards')
      expect(exported).toContain('# Testing Best Practices')
      
      // Should include content
      expect(exported).toContain('Write clean, readable code')
      expect(exported).toContain('Write unit tests for all functions')
      
      // Should separate rules with horizontal rules
      expect(exported).toContain('---')
      
      // Check structure
      const sections = exported.split('---')
      expect(sections).toHaveLength(2)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle rules without descriptions', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qodo-nodesc-'))
    const bestPracticesPath = join(tempDir, 'best_practices.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'basic-rule',
          alwaysApply: true
        },
        content: 'Always validate user input before processing'
      }
    ]

    try {
      exportToQodo(rules, bestPracticesPath)

      const exported = readFileSync(bestPracticesPath, 'utf8')
      
      // Should not have a header if no description
      expect(exported).not.toContain('#')
      expect(exported.trim()).toBe('Always validate user input before processing')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should preserve content formatting during import/export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qodo-preserve-'))
    const bestPracticesPath = join(tempDir, 'best_practices.md')
    
    const originalContent = `# Development Best Practices

## Code Organization

\`\`\`
src/
  components/
    common/
    pages/
  utils/
  types/
\`\`\`

### Key Principles

1. **Single Responsibility** - Each function should do one thing well
2. **DRY (Don't Repeat Yourself)** - Avoid code duplication
3. **KISS (Keep It Simple, Stupid)** - Prefer simple solutions

> **Important**: Always consider the maintainability of your code

## Error Handling Patterns

\`\`\`typescript
// Good: Explicit error handling
try {
  const result = await riskyOperation()
  return { success: true, data: result }
} catch (error) {
  logger.error('Operation failed', error)
  return { success: false, error: error.message }
}
\`\`\``

    writeFileSync(bestPracticesPath, originalContent, 'utf8')

    try {
      // Import
      const imported = importQodo(bestPracticesPath)
      
      // Export to a different location
      const exportPath = join(tempDir, 'best_practices-exported.md')
      exportToQodo(imported.rules, exportPath)
      
      const exported = readFileSync(exportPath, 'utf8')
      
      // The content should be preserved (with added header)
      expect(exported).toContain('# Qodo best practices and coding standards')
      expect(exported).toContain('Single Responsibility')
      expect(exported).toContain('riskyOperation()')
      expect(exported).toContain('> **Important**')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle multiple rules with proper separation', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qodo-multiple-'))
    const bestPracticesPath = join(tempDir, 'best_practices.md')

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'security',
          description: 'Security Guidelines',
          priority: 'high'
        },
        content: `## Security Best Practices

- Never store secrets in code
- Use environment variables for configuration
- Validate all user inputs
- Implement proper authentication`
      },
      {
        metadata: {
          id: 'performance',
          description: 'Performance Optimization',
          priority: 'medium'
        },
        content: `## Performance Guidelines

- Use lazy loading where appropriate
- Optimize database queries
- Implement caching strategies
- Monitor application metrics`
      },
      {
        metadata: {
          id: 'documentation',
          description: 'Documentation Standards'
        },
        content: `## Documentation Requirements

- Document all public APIs
- Include code examples
- Keep README files up to date
- Write clear commit messages`
      }
    ]

    try {
      exportToQodo(rules, bestPracticesPath)

      const exported = readFileSync(bestPracticesPath, 'utf8')
      
      // Should have all three sections
      expect(exported).toContain('# Security Guidelines')
      expect(exported).toContain('# Performance Optimization')
      expect(exported).toContain('# Documentation Standards')
      
      // Should have proper separation
      const sections = exported.split('---')
      expect(sections).toHaveLength(3)
      
      // Each section should contain its content
      expect(exported).toContain('Never store secrets in code')
      expect(exported).toContain('Use lazy loading where appropriate')
      expect(exported).toContain('Document all public APIs')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})