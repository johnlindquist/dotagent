export interface RuleMetadata {
  id: string
  alwaysApply?: boolean
  scope?: string | string[]
  triggers?: string[]
  manual?: boolean
  priority?: 'high' | 'medium' | 'low'
  description?: string
  globs?: string[]
  private?: boolean // Flag for private/local rules
  [key: string]: unknown // Allow additional metadata
}

export interface RuleBlock {
  metadata: RuleMetadata
  content: string
  position?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}

export interface ImportResult {
  format: 'agent' | 'copilot' | 'cursor' | 'cline' | 'windsurf' | 'zed' | 'codex' | 'aider' | 'claude' | 'qodo' | 'unknown'
  filePath: string
  rules: RuleBlock[]
  raw?: string
}

export interface ImportResults {
  results: ImportResult[]
  errors: Array<{ file: string; error: string }>
}

export interface ExportOptions {
  format: 'agent' | 'copilot' | 'cursor' | 'cline' | 'windsurf' | 'zed' | 'codex' | 'aider' | 'claude' | 'qodo'
  outputPath?: string
  overwrite?: boolean
  includePrivate?: boolean // Include private rules in export
  skipPrivate?: boolean // Skip private rules on import
}

export interface ParserOptions {
  strict?: boolean
  preserveWhitespace?: boolean
}