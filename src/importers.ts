import { readFileSync, existsSync, readdirSync, statSync, Dirent } from 'fs'
import { join, basename, dirname } from 'path'
import matter from 'gray-matter'
import type { ImportResult, ImportResults, RuleBlock } from './types.js'
import { grayMatterOptions } from './yaml-parser.js'

/**
 * Detect if a file path indicates a private rule
 */
function isPrivateRule(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase()
  return lowerPath.includes('.local.') || lowerPath.includes('/private/') || lowerPath.includes('\\private\\')
}

export async function importAll(repoPath: string): Promise<ImportResults> {
  const results: ImportResult[] = []
  const errors: Array<{ file: string; error: string }> = []
  const warnings: string[] = []
  
  // Check for Agent directory (.agent/)
  const agentDir = join(repoPath, '.agent')
  if (existsSync(agentDir)) {
    try {
      const result = importAgent(agentDir)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: agentDir, error: String(e) })
    }
  }
  
  // Check for VS Code Copilot instructions
  const copilotPath = join(repoPath, '.github', 'copilot-instructions.md')
  if (existsSync(copilotPath)) {
    try {
      const result = importCopilot(copilotPath)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: copilotPath, error: String(e) })
    }
  }
  
  // Check for local VS Code Copilot instructions
  const copilotLocalPath = join(repoPath, '.github', 'copilot-instructions.local.md')
  if (existsSync(copilotLocalPath)) {
    try {
      const result = importCopilot(copilotLocalPath)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: copilotLocalPath, error: String(e) })
    }
  }
  
  // Check for Cursor directory (.cursor/)
  const cursorDir = join(repoPath, '.cursor')
  if (existsSync(cursorDir)) {
    try {
      const result = importCursor(cursorDir)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: cursorDir, error: String(e) })
    }
  }
  
  // Legacy single .cursorrules file
  const cursorRulesFile = join(repoPath, '.cursorrules')
  if (existsSync(cursorRulesFile)) {
    try {
      const result = importCursorLegacy(cursorRulesFile)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: cursorRulesFile, error: String(e) })
    }
  }
  
  // Check for Cline rules
  const clinerules = join(repoPath, '.clinerules')
  if (existsSync(clinerules)) {
    try {
      const result = importCline(clinerules)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: clinerules, error: String(e) })
    }
  }
  
  // Check for local Cline rules
  const clinerulesLocal = join(repoPath, '.clinerules.local')
  if (existsSync(clinerulesLocal)) {
    try {
      const result = importCline(clinerulesLocal)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: clinerulesLocal, error: String(e) })
    }
  }
  
  // Check for Windsurf rules
  const windsurfRules = join(repoPath, '.windsurfrules')
  if (existsSync(windsurfRules)) {
    try {
      const result = importWindsurf(windsurfRules)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: windsurfRules, error: String(e) })
    }
  }
  
  // Check for local Windsurf rules
  const windsurfRulesLocal = join(repoPath, '.windsurfrules.local')
  if (existsSync(windsurfRulesLocal)) {
    try {
      const result = importWindsurf(windsurfRulesLocal)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: windsurfRulesLocal, error: String(e) })
    }
  }
  
  // Check for Zed rules
  const zedRules = join(repoPath, '.rules')
  if (existsSync(zedRules)) {
    try {
      const result = importZed(zedRules)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: zedRules, error: String(e) })
    }
  }
  
  // Check for local Zed rules
  const zedRulesLocal = join(repoPath, '.rules.local')
  if (existsSync(zedRulesLocal)) {
    try {
      const result = importZed(zedRulesLocal)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: zedRulesLocal, error: String(e) })
    }
  }
  
  // Check for OpenAI Codex AGENTS.md
  const agentsMd = join(repoPath, 'AGENTS.md')
  if (existsSync(agentsMd)) {
    try {
      const result = importCodex(agentsMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: agentsMd, error: String(e) })
    }
  }
  
  // Check for local AGENTS.md
  const agentsLocalMd = join(repoPath, 'AGENTS.local.md')
  if (existsSync(agentsLocalMd)) {
    try {
      const result = importCodex(agentsLocalMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: agentsLocalMd, error: String(e) })
    }
  }
  
  // Check for CLAUDE.md (Claude Code)
  const claudeMd = join(repoPath, 'CLAUDE.md')
  if (existsSync(claudeMd)) {
    try {
      const result = importClaudeCode(claudeMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: claudeMd, error: String(e) })
    }
  }
  
  // Check for AGENTS.md (OpenCode)
  const opencodeMd = join(repoPath, 'AGENTS.md')
  if (existsSync(opencodeMd)) {
    try {
      const result = importOpenCode(opencodeMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: opencodeMd, error: String(e) })
    }
  }
  
  // Check for AGENTS.md (OpenAI Codex) - Note: This conflicts with OpenCode,
  // so we need to handle this carefully. For now, we'll prioritize OpenAI Codex
  // since it was implemented first, but this could be made configurable.
  // Users can explicitly specify the format using the CLI if needed.
  
  // Check for GEMINI.md (Gemini CLI)
  const geminiMd = join(repoPath, 'GEMINI.md')
  if (existsSync(geminiMd)) {
    try {
      const result = importGemini(geminiMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: geminiMd, error: String(e) })
    }
  }

  // Check for best_practices.md (Qodo)
  const bestPracticesMd = join(repoPath, 'best_practices.md')
  if (existsSync(bestPracticesMd)) {
    try {
      const result = importQodo(bestPracticesMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: bestPracticesMd, error: String(e) })
    }
  }

  // Check for local CLAUDE.md
  const claudeLocalMd = join(repoPath, 'CLAUDE.local.md')
  if (existsSync(claudeLocalMd)) {
    try {
      const result = importClaudeCode(claudeLocalMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: claudeLocalMd, error: String(e) })
    }
  }
  
  // Check for local GEMINI.md
  const geminiLocalMd = join(repoPath, 'GEMINI.local.md')
  if (existsSync(geminiLocalMd)) {
    try {
      const result = importGemini(geminiLocalMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: geminiLocalMd, error: String(e) })
    }
  }
  
  // Check for CONVENTIONS.md (Aider)
  const conventionsMd = join(repoPath, 'CONVENTIONS.md')
  if (existsSync(conventionsMd)) {
    try {
      const result = importAider(conventionsMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: conventionsMd, error: String(e) })
    }
  }
  
  // Check for local CONVENTIONS.md
  const conventionsLocalMd = join(repoPath, 'CONVENTIONS.local.md')
  if (existsSync(conventionsLocalMd)) {
    try {
      const result = importAider(conventionsLocalMd)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: conventionsLocalMd, error: String(e) })
    }
  }
  
  // Check for Amazon Q rules
  const amazonqRulesDir = join(repoPath, '.amazonq', 'rules')
  if (existsSync(amazonqRulesDir)) {
    try {
      const result = importAmazonQ(amazonqRulesDir)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: amazonqRulesDir, error: String(e) })
    }
  }

  // Check for Roo rules
  const rooRulesDir = join(repoPath, '.roo', 'rules')
  if (existsSync(rooRulesDir)) {
    try {
      const result = importRoo(rooRulesDir)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: rooRulesDir, error: String(e) })
    }
  }

  // Check for Kilocode rules
  const kilocodeRulesDir = join(repoPath, '.kilocode', 'rules')
  if (existsSync(kilocodeRulesDir)) {
    try {
      const result = importKilocode(kilocodeRulesDir)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: kilocodeRulesDir, error: String(e) })
    }
  }

  // Check for Junie guidelines
  const junieGuidelines = join(repoPath, '.junie', 'guidelines.md')
  if (existsSync(junieGuidelines)) {
    try {
      const result = importJunie(junieGuidelines)
      results.push(result)
      if (result.warnings) {
        warnings.push(...result.warnings)
      }
    } catch (e) {
      errors.push({ file: junieGuidelines, error: String(e) })
    }
  }
  
  return { results, errors, warnings }
}

/**
 * Import GitHub Copilot custom instructions from a file
 */
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

/**
 * Import rules from .agent directory
 */
export function importAgent(agentDir: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Recursively find all .md files in the agent directory
  function findMarkdownFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    // Ensure deterministic ordering: process directories before files, then sort alphabetically
    entries.sort((a: Dirent, b: Dirent) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        findMarkdownFiles(fullPath, relPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8')
        const { data, content: body } = matter(content, grayMatterOptions)
        
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
        
        // Set default alwaysApply to false if not specified
        if (metadata.alwaysApply === undefined) {
          metadata.alwaysApply = false
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

/**
 * Import Cursor rules from .cursor directory
 */
export function importCursor(cursorDir: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Recursively find all .mdc and .md files in the .cursor directory
  function findCursorFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    // Ensure deterministic ordering: process directories before files, then sort alphabetically
    entries.sort((a: Dirent, b: Dirent) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        findCursorFiles(fullPath, relPath)
      } else if (entry.isFile() && (entry.name.endsWith('.mdc') || entry.name.endsWith('.md'))) {
        const content = readFileSync(fullPath, 'utf-8')
        const { data, content: body } = matter(content, grayMatterOptions)
        
        // Remove any leading numeric ordering prefixes (e.g., "001-" or "12-") from each path segment
        let segments = relPath
          .replace(/\.(mdc|md)$/, '')
          .replace(/\\/g, '/')
          .split('/')
          .map((s: string) => s.replace(/^\d{2,}-/, '').replace(/\.local$/, ''))
        
        // Special handling for backward compatibility
        if (segments[0] === 'private') segments = segments.slice(1)
        // If the file is directly in the 'rules' directory, don't include 'rules' in the ID
        if (segments[0] === 'rules' && segments.length === 2) segments = segments.slice(1)
        
        const defaultId = segments.join('/')
        
        // Check if this is a private rule
        const isPrivateFile = isPrivateRule(fullPath)
        
        const metadata: any = {
          id: data.id || defaultId,
          ...data
        }
        
        // Set default alwaysApply to false if not specified
        if (metadata.alwaysApply === undefined) {
          metadata.alwaysApply = false
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
  
  findCursorFiles(cursorDir)
  
  return {
    format: 'cursor',
    filePath: cursorDir,
    rules
  }
}

/**
 * Import legacy .cursorrules file
 */
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

/**
 * Import Cline rules from .clinerules file or directory
 */
export function importCline(rulesPath: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Check if it's a directory
  if (existsSync(rulesPath) && statSync(rulesPath).isDirectory()) {
    // Recursively find all .md files
    function findMdFiles(dir: string, relativePath = ''): void {
      const entries = readdirSync(dir, { withFileTypes: true })
      
      // Ensure deterministic ordering: process directories before files, then sort alphabetically
      entries.sort((a: Dirent, b: Dirent) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      
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

/**
 * Import Windsurf rules from .windsurfrules file
 */
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

/**
 * Import Zed rules from .rules file
 */
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

/**
 * Import OpenAI Codex rules from AGENTS.md
 */
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

/**
 * Import Aider conventions from CONVENTIONS.md
 */
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

/**
 * Import Claude Code instructions from CLAUDE.md
 */
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

/**
 * Import OpenCode agents from AGENTS.md
 */
export function importOpenCode(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'opencode-agents',
    alwaysApply: true,
    description: 'OpenCode agents and instructions'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
    content: content.trim()
  }]
  
  return {
    format: 'opencode',
    filePath,
    rules,
    raw: content
  }
}

/**
 * Import Gemini CLI instructions from GEMINI.md
 */
export function importGemini(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'gemini-instructions',
    alwaysApply: true,
    description: 'Gemini CLI context and instructions'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
    content: content.trim()
  }]
  
  return {
    format: 'gemini',
    filePath,
    rules,
    raw: content
  }
}

/**
 * Import Qodo best practices from best_practices.md
 */
export function importQodo(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const rules: RuleBlock[] = [{
    metadata: {
      id: 'qodo-best-practices',
      alwaysApply: true,
      description: 'Qodo best practices and coding standards',
      scope: '**/*',
      priority: 'high'
    },
    content: content.trim()
  }]
  
  return {
    format: 'qodo',
    filePath,
    rules,
    raw: content
  }
}

/**
 * Import Amazon Q rules from .amazonq/rules directory
 */
export function importAmazonQ(rulesDir: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Recursively find all .md files in the Amazon Q rules directory
  function findMdFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    // Ensure deterministic ordering: process directories before files, then sort alphabetically
    entries.sort((a: Dirent, b: Dirent) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
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
          id: `amazonq-${defaultId}`,
          alwaysApply: true,
          description: `Amazon Q rules from ${relPath}`
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
  
  findMdFiles(rulesDir)
  
  return {
    format: 'amazonq',
    filePath: rulesDir,
    rules
  }
}

/**
 * Import Roo Code rules from .roo/rules directory
 */
export function importRoo(rulesDir: string): ImportResult {
  const rules: RuleBlock[] = []
  
  // Recursively find all .md files in the Roo rules directory
  function findMdFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
      
      // Ensure deterministic ordering: process directories before files, then sort alphabetically
      entries.sort((a: Dirent, b: Dirent) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const relPath = relativePath ? join(relativePath, entry.name) : entry.name
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          findMdFiles(fullPath, relPath)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = readFileSync(fullPath, 'utf-8')
          const { data, content: body } = matter(content, grayMatterOptions)
          
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
          
          // Set default alwaysApply to false if not specified
          if (metadata.alwaysApply === undefined) {
            metadata.alwaysApply = false
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
    
    findMdFiles(rulesDir)
    
    return {
      format: 'roo',
      filePath: rulesDir,
      rules
    }
}

/**
 * Import JetBrains Junie guidelines from .junie/guidelines.md
 */
export function importJunie(filePath: string): ImportResult {
  const content = readFileSync(filePath, 'utf-8')
  const isPrivateFile = isPrivateRule(filePath)
  
  const metadata: any = {
    id: 'junie-guidelines',
    alwaysApply: true,
    description: 'JetBrains Junie guidelines and instructions'
  }
  
  if (isPrivateFile) {
    metadata.private = true
  }
  
  const rules: RuleBlock[] = [{
    metadata,
    content: content.trim()
  }]
  
  return {
    format: 'junie',
    filePath,
    rules,
    raw: content
  }
}

/**
 * Import KiloCode rules from .kilocode/rules directory
 */
export function importKilocode(rulesDir: string): ImportResult {
  const rules: RuleBlock[] = []
  let foundMemoryBank = false
  let memoryBankImported = false
  
  // Check for memory-bank/tasks.md
  const memoryBankTasksPath = join(rulesDir, 'memory-bank', 'tasks.md')
  if (existsSync(memoryBankTasksPath)) {
    foundMemoryBank = true
    memoryBankImported = true
  }
  
  // Recursively find all .md files in the Kilocode rules directory
  function findMdFiles(dir: string, relativePath = ''): void {
    const entries = readdirSync(dir, { withFileTypes: true })
      
    // Ensure deterministic ordering: process directories before files, then sort alphabetically
    entries.sort((a: Dirent, b: Dirent) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
      
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name
      
      if (entry.isDirectory()) {
        // Skip memory-bank directory - it's separate from agent rules
        if (entry.name === 'memory-bank') {
          foundMemoryBank = true
          continue
        }
        // Recursively search subdirectories
        findMdFiles(fullPath, relPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8')
        const { data, content: body } = matter(content, grayMatterOptions)
        
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
        
        // Set default alwaysApply to false if not specified
        if (metadata.alwaysApply === undefined) {
          metadata.alwaysApply = false
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
    
  findMdFiles(rulesDir)
  
  // Build warnings array
  const warnings: string[] = []
  if (foundMemoryBank) {
    if (memoryBankImported) {
      // tasks.md was found, indicates memory bank is available
      warnings.push('memory-bank/tasks.md found - memory bank is available')
    } else {
      // Memory bank exists but wasn't processed
      warnings.push('memory-bank/tasks.md found but not imported')
    }
  }
  
  return {
    format: 'kilocode',
    filePath: rulesDir,
    rules,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}