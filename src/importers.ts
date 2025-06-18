import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import type { ImportResult, ImportResults, RuleBlock } from './types.js'

export async function importAll(repoPath: string): Promise<ImportResults> {
  const results: ImportResult[] = []
  const errors: Array<{ file: string; error: string }> = []
  
  // Check for Agent directory (.agent/)
  const agentDir = join(repoPath, '.agent')
  if (existsSync(agentDir)) {
    try {
      results.push(importAgent(agentDir))
    } catch (e) {
      errors.push({ file: agentDir, error: String(e) })
    }
  }
  
  // Check for VS Code Copilot instructions
  const copilotPath = join(repoPath, '.github', 'copilot-instructions.md')
  if (existsSync(copilotPath)) {
    try {
      results.push(importCopilot(copilotPath))
    } catch (e) {
      errors.push({ file: copilotPath, error: String(e) })
    }
  }
  
  // Check for Cursor rules
  const cursorRulesDir = join(repoPath, '.cursor', 'rules')
  if (existsSync(cursorRulesDir)) {
    try {
      results.push(importCursor(cursorRulesDir))
    } catch (e) {
      errors.push({ file: cursorRulesDir, error: String(e) })
    }
  }
  
  // Legacy single .cursorrules file
  const cursorRulesFile = join(repoPath, '.cursorrules')
  if (existsSync(cursorRulesFile)) {
    try {
      results.push(importCursorLegacy(cursorRulesFile))
    } catch (e) {
      errors.push({ file: cursorRulesFile, error: String(e) })
    }
  }
  
  // Check for Cline rules
  const clinerules = join(repoPath, '.clinerules')
  if (existsSync(clinerules)) {
    try {
      results.push(importCline(clinerules))
    } catch (e) {
      errors.push({ file: clinerules, error: String(e) })
    }
  }
  
  // Check for Windsurf rules
  const windsurfRules = join(repoPath, '.windsurfrules')
  if (existsSync(windsurfRules)) {
    try {
      results.push(importWindsurf(windsurfRules))
    } catch (e) {
      errors.push({ file: windsurfRules, error: String(e) })
    }
  }
  
  // Check for Zed rules
  const zedRules = join(repoPath, '.rules')
  if (existsSync(zedRules)) {
    try {
      results.push(importZed(zedRules))
    } catch (e) {
      errors.push({ file: zedRules, error: String(e) })
    }
  }
  
  // Check for OpenAI Codex AGENTS.md
  const agentsMd = join(repoPath, 'AGENTS.md')
  if (existsSync(agentsMd)) {
    try {
      results.push(importCodex(agentsMd))
    } catch (e) {
      errors.push({ file: agentsMd, error: String(e) })
    }
  }
  
  // Check for CLAUDE.md (similar to AGENTS.md)
  const claudeMd = join(repoPath, 'CLAUDE.md')
  if (existsSync(claudeMd)) {
    try {
      results.push(importCodex(claudeMd))
    } catch (e) {
      errors.push({ file: claudeMd, error: String(e) })
    }
  }
  
  return { results, errors }
}

export function importCopilot(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const rules: RuleBlock[] = [{
    metadata: {
      id: 'copilot-instructions',
      alwaysApply: true,
      description: 'GitHub Copilot custom instructions'
    },
    content: content.trim()
  }]
  
  return {
    format: 'copilot',
    filePath,
    rules,
    raw: content
  }
}

export function importAgent(agentDir: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Recursively find all .md files in the agent directory
  function findMarkdownFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        findMarkdownFiles(fullPath, relPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8')
        const { data, content: body } = matter(content)
        
        // Use relative path without extension as ID if not specified
        // Keep slashes for nested path structure
        const defaultId = relPath.replace(/\.md$/, '').replace(/\\/g, '/')
        
        rules.push({
          metadata: {
            id: data.id || defaultId,
            description: data.description,
            alwaysApply: data.alwaysApply,
            globs: data.globs,
            manual: data.manual,
            ...data
          },
          content: body.trim()
        })
      }
    }
  }
  
  findMarkdownFiles(agentDir)
  
  return {
    format: 'agent',
    filePath: agentDir,
    rules
  }
}

export function importCursor(rulesDir: string): ImportResult {
  const rules: RuleBlock[] = []
  const files = readdirSync(rulesDir).filter(f => f.endsWith('.mdc'))
  
  for (const file of files) {
    const filePath = join(rulesDir, file)
    const content = readFileSync(filePath, 'utf-8')
    const { data, content: body } = matter(content)
    
    rules.push({
      metadata: {
        id: data.id || basename(file, '.mdc'),
        description: data.description,
        alwaysApply: data.alwaysApply,
        globs: data.globs,
        manual: data.manual,
        ...data
      },
      content: body.trim()
    })
  }
  
  return {
    format: 'cursor',
    filePath: rulesDir,
    rules
  }
}

export function importCursorLegacy(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const rules: RuleBlock[] = [{
    metadata: {
      id: 'cursor-rules-legacy',
      alwaysApply: true,
      description: 'Legacy Cursor rules'
    },
    content: content.trim()
  }]
  
  return {
    format: 'cursor',
    filePath,
    rules,
    raw: content
  }
}

export function importCline(rulesPath: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Check if it's a directory
  if (existsSync(rulesPath) && statSync(rulesPath).isDirectory()) {
    // Multiple files in .clinerules/ directory
    const files = readdirSync(rulesPath)
      .filter(f => f.endsWith('.md'))
      .sort() // Ensure consistent order
    
    for (const file of files) {
      const filePath = join(rulesPath, file)
      const content = readFileSync(filePath, 'utf-8')
      
      rules.push({
        metadata: {
          id: basename(file, '.md'),
          alwaysApply: true,
          description: `Cline rules from ${file}`
        },
        content: content.trim()
      })
    }
  } else {
    // Single .clinerules file
    const content = readFileSync(rulesPath, 'utf-8')
    rules.push({
      metadata: {
        id: 'cline-rules',
        alwaysApply: true,
        description: 'Cline project rules'
      },
      content: content.trim()
    })
  }
  
  return {
    format: 'cline',
    filePath: rulesPath,
    rules
  }
}

export function importWindsurf(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const rules: RuleBlock[] = [{
    metadata: {
      id: 'windsurf-rules',
      alwaysApply: true,
      description: 'Windsurf AI rules'
    },
    content: content.trim()
  }]
  
  return {
    format: 'windsurf',
    filePath,
    rules,
    raw: content
  }
}

export function importZed(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const rules: RuleBlock[] = [{
    metadata: {
      id: 'zed-rules',
      alwaysApply: true,
      description: 'Zed editor rules'
    },
    content: content.trim()
  }]
  
  return {
    format: 'zed',
    filePath,
    rules,
    raw: content
  }
}

export function importCodex(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const format = basename(filePath) === 'AGENTS.md' ? 'codex' : 'unknown'
  
  const rules: RuleBlock[] = [{
    metadata: {
      id: format === 'codex' ? 'codex-agents' : 'claude-rules',
      alwaysApply: true,
      description: format === 'codex' ? 'OpenAI Codex agent instructions' : 'Claude AI instructions'
    },
    content: content.trim()
  }]
  
  return {
    format,
    filePath,
    rules,
    raw: content
  }
}

export function importAider(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const rules: RuleBlock[] = [{
    metadata: {
      id: 'aider-conventions',
      alwaysApply: true,
      description: 'Aider CLI conventions'
    },
    content: content.trim()
  }]
  
  return {
    format: 'aider',
    filePath,
    rules,
    raw: content
  }
}