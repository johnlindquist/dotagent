import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import type { RuleBlock, ExportOptions } from './types.js'

/**
 * @deprecated Use exportToAgent() instead. Single-file .agentconfig format is deprecated.
 */
export function toAgentMarkdown(rules: RuleBlock[]): string {
  console.warn('Warning: toAgentMarkdown() is deprecated. Use exportToAgent() to export to .agent/ directory instead.')
  
  const sections: string[] = []

  for (const rule of rules) {
    const { metadata, content } = rule

    // Extract id and other metadata
    const { id, ...otherMetadata } = metadata

    // Build the comment starting with @<id>
    let metaComment = `<!-- @${id}`

    // If there are other metadata properties, add them
    if (Object.keys(otherMetadata).length > 0) {
      // Format remaining metadata as YAML
      const metaYaml = yaml.dump(otherMetadata, {
        flowLevel: 1,
        lineWidth: -1
      }).trim()

      metaComment += `\n${metaYaml}`
    }

    metaComment += ' -->'

    // Add section
    sections.push(`${metaComment}\n\n${content}`)
  }

  return sections.join('\n\n')
}

export function exportToCopilot(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  // Combine all rules into a single markdown document
  const content = filteredRules
    .map(rule => rule.content)
    .join('\n\n---\n\n')

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToAgent(rules: RuleBlock[], outputDir: string, options?: ExportOptions): void {
  const agentDir = join(outputDir, '.agent')
  mkdirSync(agentDir, { recursive: true })

  rules.forEach(rule => {
    // Support nested folders based on rule ID (e.g., "api/auth" -> "api/auth.md")
    let filename: string
    let filePath: string
    
    if (rule.metadata.id && rule.metadata.id.includes('/')) {
      // Create nested structure based on ID
      const parts = rule.metadata.id.split('/')
      const fileName = parts.pop() + '.md'
      const subDir = join(agentDir, ...parts)
      mkdirSync(subDir, { recursive: true })
      filePath = join(subDir, fileName)
    } else {
      filename = `${rule.metadata.id || 'rule'}.md`
      if (rule.metadata.private) {
        const privDir = join(agentDir, 'private')
        mkdirSync(privDir, { recursive: true })
        filePath = join(privDir, filename)
      } else {
        filePath = join(agentDir, filename)
      }
    }

    // Prepare front matter data - filter out undefined values
    const frontMatterBase: Record<string, unknown> = {}

    if (rule.metadata.description !== undefined) frontMatterBase.description = rule.metadata.description
    if (rule.metadata.alwaysApply !== undefined) frontMatterBase.alwaysApply = rule.metadata.alwaysApply
    if (rule.metadata.globs !== undefined) frontMatterBase.globs = rule.metadata.globs
    if (rule.metadata.manual !== undefined) frontMatterBase.manual = rule.metadata.manual
    if (rule.metadata.scope !== undefined) frontMatterBase.scope = rule.metadata.scope
    if (rule.metadata.priority !== undefined) frontMatterBase.priority = rule.metadata.priority
    if (rule.metadata.triggers !== undefined) frontMatterBase.triggers = rule.metadata.triggers

    // Add other metadata fields but exclude 'private' if it's false
    for (const [key, value] of Object.entries(rule.metadata)) {
      if (!['id', 'description', 'alwaysApply', 'globs', 'manual', 'scope', 'priority', 'triggers'].includes(key) && value !== undefined) {
        // Don't include private: false in frontmatter
        if (key === 'private' && value === false) continue
        frontMatterBase[key] = value
      }
    }

    const frontMatter = frontMatterBase

    // Create Markdown content with frontmatter
    const mdContent = matter.stringify(rule.content, frontMatter)
    writeFileSync(filePath, mdContent, 'utf-8')
  })
}

export function exportToCursor(rules: RuleBlock[], outputDir: string, options?: ExportOptions): void {
  const rulesDir = join(outputDir, '.cursor', 'rules')
  mkdirSync(rulesDir, { recursive: true })

  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  for (const rule of filteredRules) {
    // Support nested folders based on rule ID
    let filePath: string
    
    if (rule.metadata.id && rule.metadata.id.includes('/')) {
      // Create nested structure based on ID
      const parts = rule.metadata.id.split('/')
      const fileName = parts.pop() + '.mdc'
      const subDir = join(rulesDir, ...parts)
      mkdirSync(subDir, { recursive: true })
      filePath = join(subDir, fileName)
    } else {
      const filename = `${rule.metadata.id || 'rule'}.mdc`
      filePath = join(rulesDir, filename)
    }

    // Prepare front matter data - filter out undefined values
    const frontMatterBase: Record<string, unknown> = {}

    if (rule.metadata.description !== undefined) frontMatterBase.description = rule.metadata.description
    if (rule.metadata.alwaysApply !== undefined) frontMatterBase.alwaysApply = rule.metadata.alwaysApply
    if (rule.metadata.globs !== undefined) frontMatterBase.globs = rule.metadata.globs
    if (rule.metadata.manual !== undefined) frontMatterBase.manual = rule.metadata.manual
    if (rule.metadata.scope !== undefined) frontMatterBase.scope = rule.metadata.scope
    if (rule.metadata.priority !== undefined) frontMatterBase.priority = rule.metadata.priority
    if (rule.metadata.triggers !== undefined) frontMatterBase.triggers = rule.metadata.triggers

    // Add other metadata fields but exclude 'private' if it's false
    for (const [key, value] of Object.entries(rule.metadata)) {
      if (!['id', 'description', 'alwaysApply', 'globs', 'manual', 'scope', 'priority', 'triggers'].includes(key) && value !== undefined) {
        // Don't include private: false in frontmatter
        if (key === 'private' && value === false) continue
        frontMatterBase[key] = value
      }
    }

    const frontMatter = frontMatterBase

    // Create MDC content
    const mdcContent = matter.stringify(rule.content, frontMatter)
    writeFileSync(filePath, mdcContent, 'utf-8')
  }
}

export function exportToCline(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  if (outputPath.endsWith('.clinerules')) {
    // Single file mode
    const content = filteredRules
      .map(rule => {
        const header = rule.metadata.description ? `## ${rule.metadata.description}\n\n` : ''
        return header + rule.content
      })
      .join('\n\n')

    ensureDirectoryExists(outputPath)
    writeFileSync(outputPath, content, 'utf-8')
  } else {
    // Directory mode
    const rulesDir = join(outputPath, '.clinerules')
    mkdirSync(rulesDir, { recursive: true })

    filteredRules.forEach((rule, index) => {
      const filename = `${String(index + 1).padStart(2, '0')}-${rule.metadata.id || 'rule'}.md`
      const filePath = join(rulesDir, filename)
      writeFileSync(filePath, rule.content, 'utf-8')
    })
  }
}

export function exportToWindsurf(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const content = filteredRules
    .map(rule => rule.content)
    .join('\n\n')

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToZed(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const content = filteredRules
    .map(rule => rule.content)
    .join('\n\n')

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToCodex(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const content = filteredRules
    .map(rule => {
      const header = rule.metadata.description ? `# ${rule.metadata.description}\n\n` : ''
      return header + rule.content
    })
    .join('\n\n')

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToAider(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const content = filteredRules
    .map(rule => rule.content)
    .join('\n\n')

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToClaudeCode(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const content = filteredRules
    .map(rule => {
      const header = rule.metadata.description ? `# ${rule.metadata.description}\n\n` : ''
      return header + rule.content
    })
    .join('\n\n')

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportAll(rules: RuleBlock[], repoPath: string, dryRun = false, options: ExportOptions = { includePrivate: true }): void {
  // Export to all supported formats
  if (!dryRun) {
    exportToAgent(rules, repoPath, options)
    exportToCopilot(rules, join(repoPath, '.github', 'copilot-instructions.md'), options)
    exportToCursor(rules, repoPath, options)
    exportToCline(rules, join(repoPath, '.clinerules'), options)
    exportToWindsurf(rules, join(repoPath, '.windsurfrules'), options)
    exportToZed(rules, join(repoPath, '.rules'), options)
    exportToCodex(rules, join(repoPath, 'AGENTS.md'), options)
    exportToAider(rules, join(repoPath, 'CONVENTIONS.md'), options)
    exportToClaudeCode(rules, join(repoPath, 'CLAUDE.md'), options)
  }
}

function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}