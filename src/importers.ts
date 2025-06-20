import { readFileSync, existsSync, readdirSync, statSync, Dirent } from 'fs'
import { join, basename } from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import type { ImportResult, ImportResults, RuleBlock } from './types.js'

// Helper function to detect if a file/path indicates a private rule
function isPrivateRule(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase()
  return lowerPath.includes('.local.') || lowerPath.includes('/private/') || lowerPath.includes('\\private\\')
}

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
  
  // Check for local VS Code Copilot instructions
  const copilotLocalPath = join(repoPath, '.github', 'copilot-instructions.local.md')
  if (existsSync(copilotLocalPath)) {
    try {
      results.push(importCopilot(copilotLocalPath))
    } catch (e) {
      errors.push({ file: copilotLocalPath, error: String(e) })
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
  
  // Check for local Cline rules
  const clinerulesLocal = join(repoPath, '.clinerules.local')
  if (existsSync(clinerulesLocal)) {
    try {
      results.push(importCline(clinerulesLocal))
    } catch (e) {
      errors.push({ file: clinerulesLocal, error: String(e) })
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
  
  // Check for local Windsurf rules
  const windsurfRulesLocal = join(repoPath, '.windsurfrules.local')
  if (existsSync(windsurfRulesLocal)) {
    try {
      results.push(importWindsurf(windsurfRulesLocal))
    } catch (e) {
      errors.push({ file: windsurfRulesLocal, error: String(e) })
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
  
  // Check for local Zed rules
  const zedRulesLocal = join(repoPath, '.rules.local')
  if (existsSync(zedRulesLocal)) {
    try {
      results.push(importZed(zedRulesLocal))
    } catch (e) {
      errors.push({ file: zedRulesLocal, error: String(e) })
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
  
  // Check for local AGENTS.md
  const agentsLocalMd = join(repoPath, 'AGENTS.local.md')
  if (existsSync(agentsLocalMd)) {
    try {
      results.push(importCodex(agentsLocalMd))
    } catch (e) {
      errors.push({ file: agentsLocalMd, error: String(e) })
    }
  }
  
  // Check for CLAUDE.md (Claude Code)
  const claudeMd = join(repoPath, 'CLAUDE.md')
  if (existsSync(claudeMd)) {
    try {
      results.push(importClaudeCode(claudeMd))
    } catch (e) {
      errors.push({ file: claudeMd, error: String(e) })
    }
  }
  
  // Check for local CLAUDE.md
  const claudeLocalMd = join(repoPath, 'CLAUDE.local.md')
  if (existsSync(claudeLocalMd)) {
    try {
      results.push(importClaudeCode(claudeLocalMd))
    } catch (e) {
      errors.push({ file: claudeLocalMd, error: String(e) })
    }
  }
  
  // Check for CONVENTIONS.md (Aider)
  const conventionsMd = join(repoPath, 'CONVENTIONS.md')
  if (existsSync(conventionsMd)) {
    try {
      results.push(importAider(conventionsMd))
    } catch (e) {
      errors.push({ file: conventionsMd, error: String(e) })
    }
  }
  
  // Check for local CONVENTIONS.md
  const conventionsLocalMd = join(repoPath, 'CONVENTIONS.local.md')
  if (existsSync(conventionsLocalMd)) {
    try {
      results.push(importAider(conventionsLocalMd))
    } catch (e) {
      errors.push({ file: conventionsLocalMd, error: String(e) })
    }
  }
  
  return { results, errors }
}

export function importCopilot(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const isPrivate = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'copilot-instructions',
    alwaysApply: true,
    description: 'GitHub Copilot custom instructions'
  }
  
  if (isPrivate) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
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
    
    // Ensure deterministic ordering: process directories before files, then sort alphabetically
    entries.sort((a: Dirent, b: Dirent) => a.name.localeCompare(b.name))
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        findMarkdownFiles(fullPath, relPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8')
        const { data, content: body } = matter(content)
        
        // Remove any leading numeric ordering prefixes (e.g., "001-" or "12-") from each path segment
        let segments = relPath
          .replace(/\.md$/, '')
          .replace(/\\/g, '/')
          .split('/')
          .map((s: string) => s.replace(/^\d{2,}-/, '').replace(/\.local$/, ''))
        if (segments[0] === 'private') segments = segments.slice(1)
        const defaultId = segments.join('/')
        
        // Check if this is a private rule (either by path or frontmatter)
        const isPrivateFile = isPrivateRule(fullPath)
        
        const metadata: any = {
          id: data.id || defaultId,
          ...data
        }
        
        // Only set private if it's true (from file pattern or frontmatter)
        if (data.private === true || (data.private === undefined && isPrivateFile)) {
          metadata.private = true
        }
        
        rules.push({
          metadata,
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
  
  // Recursively find all .mdc files
  function findMdcFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    // Ensure deterministic ordering: process directories before files, then sort alphabetically
    entries.sort((a: Dirent, b: Dirent) => a.name.localeCompare(b.name))
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        findMdcFiles(fullPath, relPath)
      } else if (entry.isFile() && entry.name.endsWith('.mdc')) {
        const content = readFileSync(fullPath, 'utf-8')
        const { data, content: body } = matter(content)
        
        // Remove any leading numeric ordering prefixes (e.g., "001-" or "12-") from each path segment
        let segments = relPath
          .replace(/\.mdc$/, '')
          .replace(/\\/g, '/')
          .split('/')
          .map((s: string) => s.replace(/^\d{2,}-/, '').replace(/\.local$/, ''))
        if (segments[0] === 'private') segments = segments.slice(1)
        const defaultId = segments.join('/')
        
        // Check if this is a private rule
        const isPrivateFile = isPrivateRule(fullPath)
        
        const metadata: any = {
          id: data.id || defaultId,
          ...data
        }
        
        // Only set private if it's true (from file pattern or frontmatter)
        if (data.private === true || (data.private === undefined && isPrivateFile)) {
          metadata.private = true
        }
        
        rules.push({
          metadata,
          content: body.trim()
        })
      }
    }
  }
  
  findMdcFiles(rulesDir)
  
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
    // Recursively find all .md files
    function findMdFiles(dir: string, relativePath = ''): void {
      const entries = readdirSync(dir, { withFileTypes: true })
      
      // Ensure deterministic ordering: process directories before files, then sort alphabetically
      entries.sort((a: Dirent, b: Dirent) => a.name.localeCompare(b.name))
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const relPath = relativePath ? join(relativePath, entry.name) : entry.name
        
        if (entry.isDirectory()) {
          findMdFiles(fullPath, relPath)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = readFileSync(fullPath, 'utf-8')
          const isPrivateFile = isPrivateRule(fullPath)
          // Remove any leading numeric ordering prefixes (e.g., "001-" or "12-") from each path segment
          let segments = relPath
            .replace(/\.md$/, '')
            .replace(/\\/g, '/')
            .split('/')
            .map((s: string) => s.replace(/^\d{2,}-/, '').replace(/\.local$/, ''))
          if (segments[0] === 'private') segments = segments.slice(1)
          const defaultId = segments.join('/')
          
          const metadata: any = {
            id: defaultId,
            alwaysApply: true,
            description: `Cline rules from ${relPath}`
          }
          
          if (isPrivateFile) {
            metadata.private = true
          }
          
          rules.push({
            metadata,
            content: content.trim()
          })
        }
      }
    }
    
    findMdFiles(rulesPath)
  } else {
    // Single .clinerules file
    const content = readFileSync(rulesPath, 'utf-8')
    const isPrivateFile = isPrivateRule(rulesPath)
    
    const metadata: any = {
      id: 'cline-rules',
      alwaysApply: true,
      description: 'Cline project rules'
    }
    
    if (isPrivateFile) {
      metadata.private = true
    }
    
    rules.push({
      metadata,
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
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'windsurf-rules',
    alwaysApply: true,
    description: 'Windsurf AI rules'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
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
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'zed-rules',
    alwaysApply: true,
    description: 'Zed editor rules'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
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
  const format = basename(filePath) === 'AGENTS.md' || basename(filePath) === 'AGENTS.local.md' ? 'codex' : 'unknown'
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: format === 'codex' ? 'codex-agents' : 'claude-rules',
    alwaysApply: true,
    description: format === 'codex' ? 'OpenAI Codex agent instructions' : 'Claude AI instructions'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
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
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'aider-conventions',
    alwaysApply: true,
    description: 'Aider CLI conventions'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
    content: content.trim()
  }]
  
  return {
    format: 'aider',
    filePath,
    rules,
    raw: content
  }
}

export function importClaudeCode(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'claude-code-instructions',
    alwaysApply: true,
    description: 'Claude Code context and instructions'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
    content: content.trim()
  }]
  
  return {
    format: 'claude',
    filePath,
    rules,
    raw: content
  }
}