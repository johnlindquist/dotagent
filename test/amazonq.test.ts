import { describe, it, expect } from 'vitest'
import { importAmazonQ, exportToAmazonQ } from '../src/index.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RuleBlock } from '../src/types.js'

describe('Amazon Q Developer format', () => {
  it('should import Amazon Q rules directory', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-test-'))
    const rulesDir = join(tempDir, '.amazonq', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    
    // Create a rule file
    const rulePath = join(rulesDir, 'cdk-rules.md')
    const content = `All Amazon S3 buckets must have encryption enabled, enforce SSL, and block public access.

All Amazon DynamoDB Streams tables must have encryption enabled.

## Infrastructure as Code Standards

- Use AWS CDK TypeScript for all infrastructure
- Enable versioning on S3 buckets
- Apply least privilege principle for IAM roles`

    writeFileSync(rulePath, content, 'utf8')

    try {
      const result = importAmazonQ(rulesDir)

      expect(result.format).toBe('amazonq')
      expect(result.filePath).toBe(rulesDir)
      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('amazonq-cdk-rules')
      expect(result.rules[0].metadata.alwaysApply).toBe(true)
      expect(result.rules[0].metadata.description).toBe('Amazon Q rules from cdk-rules.md')
      expect(result.rules[0].content).toContain('S3 buckets must have encryption')
      expect(result.rules[0].content).toContain('DynamoDB Streams tables')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle nested rule directories', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-nested-'))
    const rulesDir = join(tempDir, '.amazonq', 'rules')
    const awsDir = join(rulesDir, 'aws')
    mkdirSync(awsDir, { recursive: true })
    
    // Create nested rule file  
    const rulePath = join(awsDir, 'security-rules.md')
    const content = `## AWS Security Best Practices

- Enable CloudTrail in all regions
- Use VPC endpoints for S3 access
- Encrypt EBS volumes at rest
- Enable GuardDuty for threat detection`

    writeFileSync(rulePath, content, 'utf8')

    try {
      const result = importAmazonQ(rulesDir)

      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.id).toBe('amazonq-aws/security-rules')
      expect(result.rules[0].metadata.description).toBe('Amazon Q rules from aws/security-rules.md')
      expect(result.rules[0].content).toContain('CloudTrail in all regions')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should export to Amazon Q format', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-export-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'security-standards',
          description: 'Security Standards',
          alwaysApply: true
        },
        content: `## Security Requirements

All APIs must use HTTPS only.
Implement rate limiting on all endpoints.
Use OAuth 2.0 for authentication.`
      },
      {
        metadata: {
          id: 'coding-standards',
          description: 'Coding Standards'
        },
        content: `## Code Quality

- Write unit tests for all functions
- Use TypeScript strict mode
- Follow ESLint recommendations`
      }
    ]

    try {
      exportToAmazonQ(rules, tempDir)

      // Check that files were created
      const securityPath = join(tempDir, '.amazonq', 'rules', 'security-standards.md')
      const codingPath = join(tempDir, '.amazonq', 'rules', 'coding-standards.md')
      
      const securityContent = readFileSync(securityPath, 'utf8')
      const codingContent = readFileSync(codingPath, 'utf8')
      
      // Should contain plain markdown without frontmatter
      expect(securityContent).toContain('All APIs must use HTTPS only')
      expect(securityContent).toContain('OAuth 2.0 for authentication')
      expect(securityContent).not.toContain('---') // No frontmatter
      
      expect(codingContent).toContain('Write unit tests for all functions')
      expect(codingContent).toContain('TypeScript strict mode')
      expect(codingContent).not.toContain('---') // No frontmatter
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle nested rule export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-nested-export-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'aws/lambda-rules',
          description: 'Lambda Best Practices'
        },
        content: `## Lambda Functions

- Use environment variables for configuration
- Set appropriate timeout values
- Enable X-Ray tracing for debugging`
      }
    ]

    try {
      exportToAmazonQ(rules, tempDir)

      // Check that nested structure was created
      const lambdaPath = join(tempDir, '.amazonq', 'rules', 'aws', 'lambda-rules.md')
      const content = readFileSync(lambdaPath, 'utf8')
      
      expect(content).toContain('environment variables for configuration')
      expect(content).toContain('X-Ray tracing for debugging')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle amazonq- prefix cleaning in export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-prefix-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'amazonq-database-rules',
          description: 'Database Rules'
        },
        content: `## Database Standards

- Use parameterized queries
- Enable connection pooling
- Implement proper indexing`
      }
    ]

    try {
      exportToAmazonQ(rules, tempDir)

      // Should clean up the amazonq- prefix in filename
      const dbPath = join(tempDir, '.amazonq', 'rules', 'database-rules.md')
      const content = readFileSync(dbPath, 'utf8')
      
      expect(content).toContain('parameterized queries')
      expect(content).toContain('connection pooling')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should preserve content formatting during import/export', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-preserve-'))
    const rulesDir = join(tempDir, '.amazonq', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    
    const originalContent = `## Development Guidelines

### Code Structure

\`\`\`
src/
  handlers/
  models/
  utils/
\`\`\`

### Important Notes

1. Always validate input parameters
2. Handle exceptions gracefully  
3. Write comprehensive tests

> Remember: Security first!`

    const rulePath = join(rulesDir, 'dev-guidelines.md')
    writeFileSync(rulePath, originalContent, 'utf8')

    try {
      // Import
      const imported = importAmazonQ(rulesDir)
      
      // Export to a different location
      const exportDir = join(tempDir, 'exported')
      exportToAmazonQ(imported.rules, exportDir)
      
      const exportPath = join(exportDir, '.amazonq', 'rules', 'dev-guidelines.md')
      const exported = readFileSync(exportPath, 'utf8')
      
      // The content should be preserved exactly
      expect(exported.trim()).toBe(originalContent.trim())
      expect(exported).toContain('Always validate input parameters')
      expect(exported).toContain('Security first!')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle private Amazon Q rules', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-private-'))
    const privateDir = join(tempDir, '.amazonq', 'rules', 'private')
    mkdirSync(privateDir, { recursive: true })
    
    const content = `## Private Development Rules

### API Configuration

Use internal endpoints for development.

### Local Testing

Mock external services locally.`

    const privateRulePath = join(privateDir, 'dev-config.local.md')
    writeFileSync(privateRulePath, content, 'utf8')

    try {
      const result = importAmazonQ(join(tempDir, '.amazonq', 'rules'))

      expect(result.rules).toHaveLength(1)
      expect(result.rules[0].metadata.private).toBe(true)
      expect(result.rules[0].metadata.id).toBe('amazonq-dev-config')
      expect(result.rules[0].content).toContain('internal endpoints')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should filter private rules during export by default', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'amazonq-private-export-'))

    const rules: RuleBlock[] = [
      {
        metadata: {
          id: 'public-rule',
          description: 'Public Rule'
        },
        content: 'This is a public rule'
      },
      {
        metadata: {
          id: 'private-rule',
          description: 'Private Rule',
          private: true
        },
        content: 'This is a private rule'
      }
    ]

    try {
      exportToAmazonQ(rules, tempDir)

      // Should only export the public rule
      const publicPath = join(tempDir, '.amazonq', 'rules', 'public-rule.md')
      const privatePath = join(tempDir, '.amazonq', 'rules', 'private-rule.md')
      
      expect(readFileSync(publicPath, 'utf8')).toContain('public rule')
      
      // Private file should not exist
      expect(() => readFileSync(privatePath, 'utf8')).toThrow()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})