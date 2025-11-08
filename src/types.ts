export type Format = 'agent' | 'copilot' | 'cursor' | 'cline' | 'windsurf' | 'zed' | 'codex' | 'aider' | 'claude' | 'qodo' | 'gemini' | 'amazonq' | 'roo' | 'junie' | 'opencode' | 'warp' | 'unknown'

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
  format: Format
  filePath: string
  rules: RuleBlock[]
  raw?: string
}

export interface ImportResults {
  results: ImportResult[]
  errors: Array<{ file: string; error: string }>
}

export interface ExportOptions {
  format?: Format
  outputPath?: string
  overwrite?: boolean
  includePrivate?: boolean // Include private rules in export
  skipPrivate?: boolean // Skip private rules on import
}

export interface ParserOptions {
  strict?: boolean
  preserveWhitespace?: boolean
}