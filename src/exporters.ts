import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import type { RuleBlock, ExportOptions } from './types.js'
import { grayMatterOptions } from './yaml-parser.js'

/**
 * Generate conditional rules section for single-file formats
 */
function generateConditionalRulesSection(rules: RuleBlock[], repoPath: string): string {
  const sections: string[] = []
  
  // Separate rules by type
  const alwaysApplyRules = rules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalRules = rules.filter(r => r.metadata.alwaysApply === false)
  
  if (conditionalRules.length === 0) {
    return ''
  }
  
  // Group rules by folder (e.g., workflows, components, etc.)
  const rulesByFolder: Record<string, RuleBlock[]> = {}
  const rulesWithScope: RuleBlock[] = []
  const rulesWithDescription: RuleBlock[] = []
  
  conditionalRules.forEach(rule => {
    // Extract folder from ID if it contains a slash
    if (rule.metadata.id && rule.metadata.id.includes('/')) {
      const folder = rule.metadata.id.split('/')[0]
      if (!rulesByFolder[folder]) {
        rulesByFolder[folder] = []
      }
      rulesByFolder[folder].push(rule)
    }
    
    // Categorize by scope/description
    if (rule.metadata.scope) {
      rulesWithScope.push(rule)
    } else if (rule.metadata.description && !rule.metadata.scope && !rule.metadata.id?.includes('/')) {
      // Only treat as description-based if it's not in a folder
      rulesWithDescription.push(rule)
    }
  })
  
  sections.push('## Context-Specific Rules')
  sections.push('')
  
  // Add rules with scope patterns
  if (rulesWithScope.length > 0) {
    rulesWithScope.forEach(rule => {
      const scopes = Array.isArray(rule.metadata.scope) ? rule.metadata.scope : [rule.metadata.scope]
      scopes.forEach(scope => {
        const rulePath = `.agent/${rule.metadata.id}.md`
        const description = rule.metadata.description ? ` - ${rule.metadata.description}` : ''
        sections.push(`When working with files matching \`${scope}\`, also apply:`)
        sections.push(`→ [${rule.metadata.id}](${rulePath})${description}`)
        sections.push('')
      })
    })
  }
  
  // Add rules with description keywords
  if (rulesWithDescription.length > 0) {
    rulesWithDescription.forEach(rule => {
      const rulePath = `.agent/${rule.metadata.id}.md`
      sections.push(`When working with ${rule.metadata.description}, also apply:`)
      sections.push(`→ [${rule.metadata.id}](${rulePath})`)
      sections.push('')
    })
  }
  
  // Add folder-based sections (e.g., Workflows)
  Object.entries(rulesByFolder).forEach(([folder, folderRules]) => {
    // Skip if already handled above
    const unhandledRules = folderRules.filter(r => 
      !rulesWithScope.includes(r) && !rulesWithDescription.includes(r)
    )
    
    if (unhandledRules.length > 0) {
      // Capitalize folder name for section title
      const sectionTitle = folder.charAt(0).toUpperCase() + folder.slice(1)
      sections.push(`## ${sectionTitle}`)
      sections.push('')
      
      unhandledRules.forEach(rule => {
        const rulePath = `.agent/${rule.metadata.id}.md`
        const description = rule.metadata.description ? ` - ${rule.metadata.description}` : ''
        sections.push(`→ [${rule.metadata.id}](${rulePath})${description}`)
      })
      sections.push('')
    }
  })
  
  return sections.join('\n')
}

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
  
  // Separate always-apply rules from conditional rules
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  // Combine always-apply rules into main content
  const mainContent = alwaysApplyRules
    .map(rule => rule.content)
    .join('\n\n---\n\n')
  
  // Add conditional rules section if there are any
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n---\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToAgent(rules: RuleBlock[], outputDir: string, options?: ExportOptions): void {
  const agentDir = join(outputDir, '.agent')
  mkdirSync(agentDir, { recursive: true })

  let topIndex = 1;
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
      if (rule.metadata.private) {
        const prefix = String(topIndex).padStart(3, '0') + '-'
        topIndex++
        filename = `${prefix}${rule.metadata.id || 'rule'}.md`
        const privDir = join(agentDir, 'private')
        mkdirSync(privDir, { recursive: true })
        filePath = join(privDir, filename)
      } else {
        filename = `${rule.metadata.id || 'rule'}.md`
        filePath = join(agentDir, filename)
      }
    }

    // Prepare front matter data - filter out undefined and null values
    const frontMatterBase: Record<string, unknown> = {}

    if (rule.metadata.description !== undefined && rule.metadata.description !== null) frontMatterBase.description = rule.metadata.description
    if (rule.metadata.alwaysApply !== undefined) frontMatterBase.alwaysApply = rule.metadata.alwaysApply
    if (rule.metadata.globs !== undefined && rule.metadata.globs !== null) frontMatterBase.globs = rule.metadata.globs
    if (rule.metadata.manual !== undefined && rule.metadata.manual !== null) frontMatterBase.manual = rule.metadata.manual
    if (rule.metadata.scope !== undefined && rule.metadata.scope !== null) frontMatterBase.scope = rule.metadata.scope
    if (rule.metadata.priority !== undefined && rule.metadata.priority !== null) frontMatterBase.priority = rule.metadata.priority
    if (rule.metadata.triggers !== undefined && rule.metadata.triggers !== null) frontMatterBase.triggers = rule.metadata.triggers

    // Add other metadata fields but exclude 'private' if it's false or null
    for (const [key, value] of Object.entries(rule.metadata)) {
      if (!['id', 'description', 'alwaysApply', 'globs', 'manual', 'scope', 'priority', 'triggers'].includes(key) && value !== undefined && value !== null) {
        // Don't include private: false in frontmatter
        if (key === 'private' && value === false) continue
        frontMatterBase[key] = value
      }
    }

    const frontMatter = frontMatterBase

    // Create Markdown content with frontmatter
    const mdContent = matter.stringify(rule.content, frontMatter, grayMatterOptions)
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

    // Prepare front matter data - filter out undefined and null values
    const frontMatterBase: Record<string, unknown> = {}

    if (rule.metadata.description !== undefined && rule.metadata.description !== null) frontMatterBase.description = rule.metadata.description
    if (rule.metadata.alwaysApply !== undefined) frontMatterBase.alwaysApply = rule.metadata.alwaysApply
    if (rule.metadata.globs !== undefined && rule.metadata.globs !== null) frontMatterBase.globs = rule.metadata.globs
    if (rule.metadata.manual !== undefined && rule.metadata.manual !== null) frontMatterBase.manual = rule.metadata.manual
    if (rule.metadata.scope !== undefined && rule.metadata.scope !== null) frontMatterBase.scope = rule.metadata.scope
    if (rule.metadata.priority !== undefined && rule.metadata.priority !== null) frontMatterBase.priority = rule.metadata.priority
    if (rule.metadata.triggers !== undefined && rule.metadata.triggers !== null) frontMatterBase.triggers = rule.metadata.triggers

    // Add other metadata fields but exclude 'private' if it's false or null
    for (const [key, value] of Object.entries(rule.metadata)) {
      if (!['id', 'description', 'alwaysApply', 'globs', 'manual', 'scope', 'priority', 'triggers'].includes(key) && value !== undefined && value !== null) {
        // Don't include private: false in frontmatter
        if (key === 'private' && value === false) continue
        frontMatterBase[key] = value
      }
    }

    const frontMatter = frontMatterBase

    // Create MDC content
    const mdcContent = matter.stringify(rule.content, frontMatter, grayMatterOptions)
    writeFileSync(filePath, mdcContent, 'utf-8')
  }
}

export function exportToCline(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  if (outputPath.endsWith('.clinerules')) {
    // Single file mode
    const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
    const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
    
    const mainContent = alwaysApplyRules
      .map(rule => {
        const header = rule.metadata.description ? `## ${rule.metadata.description}\n\n` : ''
        return header + rule.content
      })
      .join('\n\n')
    
    const fullContent = conditionalSection 
      ? `${mainContent}\n\n${conditionalSection}`
      : mainContent

    ensureDirectoryExists(outputPath)
    writeFileSync(outputPath, fullContent, 'utf-8')
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
  
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  const mainContent = alwaysApplyRules
    .map(rule => rule.content)
    .join('\n\n')
  
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToZed(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  const mainContent = alwaysApplyRules
    .map(rule => rule.content)
    .join('\n\n')
  
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToCodex(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  const mainContent = alwaysApplyRules
    .map(rule => {
      const header = rule.metadata.description ? `# ${rule.metadata.description}\n\n` : ''
      return header + rule.content
    })
    .join('\n\n')
  
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToAider(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  const mainContent = alwaysApplyRules
    .map(rule => rule.content)
    .join('\n\n')
  
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToClaudeCode(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  const mainContent = alwaysApplyRules
    .map(rule => {
      const header = rule.metadata.description ? `# ${rule.metadata.description}\n\n` : ''
      return header + rule.content
    })
    .join('\n\n')
  
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToGemini(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
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

export function exportToQodo(rules: RuleBlock[], outputPath: string, options?: ExportOptions): void {
  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  const alwaysApplyRules = filteredRules.filter(r => r.metadata.alwaysApply !== false)
  const conditionalSection = generateConditionalRulesSection(filteredRules, dirname(outputPath))
  
  const mainContent = alwaysApplyRules
    .map(rule => {
      const header = rule.metadata.description ? `# ${rule.metadata.description}\n\n` : ''
      return header + rule.content
    })
    .join('\n\n---\n\n')
  
  const fullContent = conditionalSection 
    ? `${mainContent}\n\n---\n\n${conditionalSection}`
    : mainContent

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, fullContent, 'utf-8')
}

export function exportToAmazonQ(rules: RuleBlock[], outputDir: string, options?: ExportOptions): void {
  const rulesDir = join(outputDir, '.amazonq', 'rules')
  mkdirSync(rulesDir, { recursive: true })

  // Filter out private rules unless includePrivate is true
  const filteredRules = rules.filter(rule => !rule.metadata.private || options?.includePrivate)
  
  for (const rule of filteredRules) {
    // Support nested folders based on rule ID
    let filePath: string
    
    if (rule.metadata.id && rule.metadata.id.includes('/')) {
      // Create nested structure based on ID
      const parts = rule.metadata.id.split('/')
      const fileName = parts.pop() + '.md'
      const subDir = join(rulesDir, ...parts)
      mkdirSync(subDir, { recursive: true })
      filePath = join(subDir, fileName)
    } else {
      // Clean up the ID by removing amazonq- prefix if present
      const cleanId = rule.metadata.id?.startsWith('amazonq-') 
        ? rule.metadata.id.substring(8) 
        : rule.metadata.id || 'rule'
      const filename = `${cleanId}.md`
      filePath = join(rulesDir, filename)
    }

    // Amazon Q uses simple markdown format without frontmatter
    writeFileSync(filePath, rule.content, 'utf-8')
  }
}

export function exportAll(rules: RuleBlock[], repoPath: string, dryRun = false, options: ExportOptions = { includePrivate: false }): void {
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
    exportToGemini(rules, join(repoPath, 'GEMINI.md'), options)
    exportToQodo(rules, join(repoPath, 'best_practices.md'), options)
    exportToAmazonQ(rules, repoPath, options)
  }
}

function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}