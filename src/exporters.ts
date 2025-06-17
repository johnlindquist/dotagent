import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import type { RuleBlock, ExportOptions } from './types.js'

export function toAgentMarkdown(rules: RuleBlock[]): string {
  const sections: string[] = []
  
  for (const rule of rules) {
    const { metadata, content } = rule
    
    // Build metadata comment
    const metaLines: string[] = []
    
    // Format metadata as YAML
    const metaYaml = yaml.dump(metadata, {
      flowLevel: 1,
      lineWidth: -1
    }).trim()
    
    // Create the HTML comment
    const metaComment = `<!-- @meta\n${metaYaml}\n-->`
    
    // Add section
    sections.push(`${metaComment}\n\n${content}`)
  }
  
  return sections.join('\n\n<!-- @pagebreak -->\n\n')
}

export function exportToCopilot(rules: RuleBlock[], outputPath: string): void {
  // Combine all rules into a single markdown document
  const content = rules
    .map(rule => rule.content)
    .join('\n\n---\n\n')
  
  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToCursor(rules: RuleBlock[], outputDir: string): void {
  const rulesDir = join(outputDir, '.cursor', 'rules')
  mkdirSync(rulesDir, { recursive: true })
  
  for (const rule of rules) {
    const filename = `${rule.metadata.id || 'rule'}.mdc`
    const filePath = join(rulesDir, filename)
    
    // Prepare front matter data - filter out undefined values
    const frontMatterBase: Record<string, unknown> = {}
    
    if (rule.metadata.description !== undefined) frontMatterBase.description = rule.metadata.description
    if (rule.metadata.alwaysApply !== undefined) frontMatterBase.alwaysApply = rule.metadata.alwaysApply
    if (rule.metadata.globs !== undefined) frontMatterBase.globs = rule.metadata.globs
    if (rule.metadata.manual !== undefined) frontMatterBase.manual = rule.metadata.manual
    
    // Add other metadata fields
    Object.entries(rule.metadata).forEach(([key, value]) => {
      if (!['id', 'description', 'alwaysApply', 'globs', 'manual'].includes(key) && value !== undefined) {
        frontMatterBase[key] = value
      }
    })
    
    const frontMatter = frontMatterBase
    
    // Create MDC content
    const mdcContent = matter.stringify(rule.content, frontMatter)
    writeFileSync(filePath, mdcContent, 'utf-8')
  }
}

export function exportToCline(rules: RuleBlock[], outputPath: string): void {
  if (outputPath.endsWith('.clinerules')) {
    // Single file mode
    const content = rules
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
    
    rules.forEach((rule, index) => {
      const filename = `${String(index + 1).padStart(2, '0')}-${rule.metadata.id || 'rule'}.md`
      const filePath = join(rulesDir, filename)
      writeFileSync(filePath, rule.content, 'utf-8')
    })
  }
}

export function exportToWindsurf(rules: RuleBlock[], outputPath: string): void {
  const content = rules
    .map(rule => rule.content)
    .join('\n\n')
  
  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToZed(rules: RuleBlock[], outputPath: string): void {
  const content = rules
    .map(rule => rule.content)
    .join('\n\n')
  
  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToCodex(rules: RuleBlock[], outputPath: string): void {
  const content = rules
    .map(rule => {
      const header = rule.metadata.description ? `# ${rule.metadata.description}\n\n` : ''
      return header + rule.content
    })
    .join('\n\n')
  
  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportToAider(rules: RuleBlock[], outputPath: string): void {
  const content = rules
    .map(rule => rule.content)
    .join('\n\n')
  
  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, content, 'utf-8')
}

export function exportAll(rules: RuleBlock[], repoPath: string, dryRun = false): void {
  // Export to all supported formats
  if (!dryRun) {
    exportToCopilot(rules, join(repoPath, '.github', 'copilot-instructions.md'))
    exportToCursor(rules, repoPath)
    exportToCline(rules, join(repoPath, '.clinerules'))
    exportToWindsurf(rules, join(repoPath, '.windsurfrules'))
    exportToZed(rules, join(repoPath, '.rules'))
    exportToCodex(rules, join(repoPath, 'AGENTS.md'))
    exportToAider(rules, join(repoPath, 'CONVENTIONS.md'))
  }
}

function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}