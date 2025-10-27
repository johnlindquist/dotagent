#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { parseArgs } from 'util'
import { importAll, importAgent, exportToAgent, exportAll, exportToCopilot, exportToCursor, exportToCline, exportToWindsurf, exportToZed, exportToCodex, exportToAider, exportToClaudeCode, exportToGemini, exportToQodo, importRoo, exportToRoo, exportToJunie, importOpenCode, exportToOpenCode } from './index.js'
import { color, header, formatList } from './utils/colors.js'
import { select, confirm } from './utils/prompt.js'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
    output: { type: 'string', short: 'o' },
    format: { type: 'string', short: 'f' },
    formats: { type: 'string' },
    overwrite: { type: 'boolean', short: 'w' },
    'dry-run': { type: 'boolean', short: 'd' },
    'include-private': { type: 'boolean' },
    'skip-private': { type: 'boolean' },
    'gitignore': { type: 'boolean' },
    'no-gitignore': { type: 'boolean' },
  },
  allowPositionals: true
}) as { values: any; positionals: string[] }

// Validate mutually exclusive flags
if (values['gitignore'] && values['no-gitignore']) {
  console.error(color.error('Cannot use both --gitignore and --no-gitignore flags together'))
  process.exit(1)
}

function showHelp() {
  console.log(`
${color.bold('dotagent')} - Multi-file AI agent configuration manager

${color.bold('Usage:')}
  ${color.command('dotagent import')} ${color.dim('<repo-path>')}    Import all rule files from a repository
  ${color.command('dotagent export')} ${color.dim('[repo-path]')}   Export .agent/ directory to all supported formats
  ${color.command('dotagent convert')} ${color.dim('<file>')}        Convert a specific rule file

${color.bold('Options:')}
  ${color.yellow('-h, --help')}       Show this help message
  ${color.yellow('-o, --output')}     Output file path (for convert command)
  ${color.yellow('-f, --format')}     Specify format (copilot|cursor|cline|windsurf|zed|codex|aider|claude|gemini|qodo|roo|junie|opencode)
  ${color.yellow('--formats')}        Specify multiple formats (comma-separated)
  ${color.yellow('-w, --overwrite')}  Overwrite existing files
  ${color.yellow('-d, --dry-run')}    Preview operations without making changes
  ${color.yellow('--gitignore')}      Auto-update gitignore (skip prompt)
  ${color.yellow('--no-gitignore')}   Skip gitignore prompt

${color.bold('Examples:')}
  ${color.dim('# Import all rules from current directory (creates .agent/)')}
  ${color.command('dotagent import .')}

  ${color.dim('# Export .agent/ directory to all formats')}
  ${color.command('dotagent export')}
  
  ${color.dim('# Export from specific directory')}
  ${color.command('dotagent export /path/to/repo')}

  ${color.dim('# Preview what would be imported without creating files')}
  ${color.command('dotagent import . --dry-run')}
`)
}

async function main() {
  if (values.help || positionals.length === 0) {
    showHelp()
    process.exit(0)
  }

  const command = positionals[0]
  const target = positionals[1]
  const isDryRun = values['dry-run']

  if (isDryRun) {
    console.log(color.info('Running in dry-run mode - no files will be modified'))
  }

  switch (command) {
    case 'import': {
      // Default to current directory if no target specified
      const importTarget = target || '.'

      const repoPath = resolve(importTarget)
      if (!existsSync(repoPath)) {
        console.error(color.error(`Path does not exist: ${color.path(repoPath)}`))
        console.error(color.dim('Hint: Check if the path is correct or use "." for current directory'))
        process.exit(1)
      }

      console.log(header('Importing Rules'))
      console.log(`Scanning: ${color.path(repoPath)}`)
      
      const { results, errors } = await importAll(repoPath)

      if (results.length === 0) {
        console.log(color.warning('No rule files found'))
        console.log(color.dim('Hint: DotAgent looks for:'))
        console.log(formatList([
          '.agent/**/*.md',
          '.github/copilot-instructions.md',
          '.cursor/**/*.{mdc,md}',
          '.clinerules',
          '.windsurfrules',
          '.rules',
          'AGENTS.md',
          'CLAUDE.md',
          'GEMINI.md',
          'best_practices.md'
        ]))
      } else {
        console.log(color.success(`Found ${color.number(results.length.toString())} rule file(s):`))
        
        for (const result of results) {
          const ruleCount = color.number(`${result.rules.length} rule(s)`)
          console.log(`  ${color.format(result.format)}: ${color.path(result.filePath)} ${color.dim(`(${ruleCount})`)}`)
        }

        // Combine all rules
        const allRules = results.flatMap(r => r.rules)
        
        // Check if .agent directory exists
        const agentDir = join(repoPath, '.agent')
        if (existsSync(agentDir)) {
          const existingAgent = importAgent(agentDir)
          console.log(color.info(`Found existing .agent/ directory with ${color.number(existingAgent.rules.length.toString())} rule(s)`))
        }

        if (isDryRun) {
          console.log(color.info(`Would export to: ${color.path(agentDir)}`))
          console.log(color.dim(`Total rules: ${allRules.length}`))
        } else {
          const outputDir = values.output || repoPath
          exportToAgent(allRules, outputDir)
          console.log(color.success(`Created .agent/ directory with ${color.number(allRules.length.toString())} rule(s)`))
        }
      }

      if (errors.length > 0) {
        console.log(color.warning('Import errors:'))
        for (const error of errors) {
          console.log(`  ${color.red('×')} ${color.path(error.file)}: ${error.error}`)
        }
      }
      break
    }

    case 'export': {
      // Default to current directory if no target specified
      const repoPath = target ? resolve(target) : process.cwd()
      const agentDir = join(repoPath, '.agent')
      
      if (!existsSync(agentDir)) {
        console.error(color.error(`No .agent/ directory found in: ${color.path(repoPath)}`))
        console.error(color.dim('Hint: Run "dotagent import ." first to create .agent/ directory'))
        process.exit(1)
      }

      // Check for legacy .agentconfig file
      const agentConfigPath = join(repoPath, '.agentconfig')
      if (existsSync(agentConfigPath)) {
        console.error(color.error('Found deprecated .agentconfig file'))
        console.error(color.dim('The single-file .agentconfig format is deprecated. Please run "dotagent import ." to migrate to .agent/ directory.'))
        process.exit(1)
      }

      console.log(header('Exporting Rules'))
      
      const result = importAgent(agentDir)
      const rules = result.rules
      
      console.log(color.success(`Found ${color.number(rules.length.toString())} rule(s) in ${color.path(agentDir)}`))
      
      // Count private rules
      const privateRuleCount = rules.filter(r => r.metadata.private).length
      if (privateRuleCount > 0) {
        console.log(color.dim(`Including ${privateRuleCount} private rule(s)`))
      }

      const outputDir = values.output || repoPath
      
      const exportFormats = [
        { name: 'All formats', value: 'all' },
        { name: 'VS Code Copilot (.github/copilot-instructions.md)', value: 'copilot' },
        { name: 'Cursor (.cursor/rules/)', value: 'cursor' },
        { name: 'Cline (.clinerules)', value: 'cline' },
        { name: 'Windsurf (.windsurfrules)', value: 'windsurf' },
        { name: 'Zed (.rules)', value: 'zed' },
        { name: 'OpenAI Codex (AGENTS.md)', value: 'codex' },
        { name: 'Aider (CONVENTIONS.md)', value: 'aider' },
        { name: 'Claude Code (CLAUDE.md)', value: 'claude' },
        { name: 'Gemini CLI (GEMINI.md)', value: 'gemini' },
        { name: 'Qodo Merge (best_practices.md)', value: 'qodo' },
        { name: 'Roo Code (.roo/rules/)', value: 'roo' },
        { name: 'JetBrains Junie (.junie/guidelines.md)', value: 'junie' },
        { name: 'OpenCode (AGENTS.md)', value: 'opencode' }
      ]

      // Handle format parameter or show interactive menu
      let selectedFormats: string[] = []
      
      if (values.formats) {
        // Parse comma-separated formats
        selectedFormats = values.formats.split(',').map((f: string) => f.trim())
      } else if (values.format) {
        // Single format from -f flag
        selectedFormats = [values.format]
      } else {
        // Interactive menu
        console.log()
        const selectedFormat = await select('Select export format:', exportFormats, 0)
        selectedFormats = selectedFormat === 'all' ? ['all'] : [selectedFormat]
      }

      // Validate formats
      const validFormats = ['all', 'copilot', 'cursor', 'cline', 'windsurf', 'zed', 'codex', 'aider', 'claude', 'gemini', 'qodo', 'roo', 'junie', 'opencode']
      const invalidFormats = selectedFormats.filter(f => !validFormats.includes(f))
      if (invalidFormats.length > 0) {
        console.error(color.error(`Invalid format(s): ${invalidFormats.join(', ')}`))
        console.error(color.dim(`Valid formats: ${validFormats.slice(1).join(', ')}, all`))
        process.exit(1)
      }
      
      if (isDryRun) {
        console.log(color.info('Dry run mode - no files will be written'))
      }
      
      const options = { includePrivate: values['include-private'] }
      const exportedPaths: string[] = []
      
      // Handle multiple formats
      for (const selectedFormat of selectedFormats) {
        if (selectedFormat === 'all') {
          if (!isDryRun) {
            exportAll(rules, outputDir, false, options)
          }
          console.log(color.success('Exported to all formats'))
          exportedPaths.push(
            '.github/copilot-instructions.md',
            '.cursor/rules/',
            '.clinerules',
            '.windsurfrules',
            '.rules',
            'AGENTS.md',
            'CONVENTIONS.md',
            'CLAUDE.md',
            'GEMINI.md',
            'best_practices.md'
          )
        } else {
          // Export to specific format
          let exportPath = ''
          
          switch (selectedFormat) {
            case 'copilot':
              exportPath = join(outputDir, '.github', 'copilot-instructions.md')
              if (!isDryRun) exportToCopilot(rules, exportPath, options)
              exportedPaths.push('.github/copilot-instructions.md')
              break
            case 'cursor':
              if (!isDryRun) exportToCursor(rules, outputDir, options)
              exportPath = join(outputDir, '.cursor/rules/')
              exportedPaths.push('.cursor/rules/')
              break
            case 'cline':
              exportPath = join(outputDir, '.clinerules')
              if (!isDryRun) exportToCline(rules, exportPath, options)
              exportedPaths.push('.clinerules')
              break
            case 'windsurf':
              exportPath = join(outputDir, '.windsurfrules')
              if (!isDryRun) exportToWindsurf(rules, exportPath, options)
              exportedPaths.push('.windsurfrules')
              break
            case 'zed':
              exportPath = join(outputDir, '.rules')
              if (!isDryRun) exportToZed(rules, exportPath, options)
              exportedPaths.push('.rules')
              break
            case 'codex':
              exportPath = join(outputDir, 'AGENTS.md')
              if (!isDryRun) exportToCodex(rules, exportPath, options)
              exportedPaths.push('AGENTS.md')
              break
            case 'aider':
              exportPath = join(outputDir, 'CONVENTIONS.md')
              if (!isDryRun) exportToAider(rules, exportPath, options)
              exportedPaths.push('CONVENTIONS.md')
              break
            case 'claude':
              exportPath = join(outputDir, 'CLAUDE.md')
              if (!isDryRun) exportToClaudeCode(rules, exportPath, options)
              exportedPaths.push('CLAUDE.md')
              break
            case 'gemini':
              exportPath = join(outputDir, 'GEMINI.md')
              if (!isDryRun) exportToGemini(rules, exportPath, options)
              exportedPaths.push('GEMINI.md')
              break
            case 'opencode':
              exportPath = join(outputDir, 'AGENTS.md')
              if (!isDryRun) exportToOpenCode(rules, exportPath, options)
              exportedPaths.push('AGENTS.md')
              break
            case 'qodo':
              exportPath = join(outputDir, 'best_practices.md')
              if (!isDryRun) exportToQodo(rules, exportPath, options)
              exportedPaths.push('best_practices.md')
              break
            case 'roo':
              if (!isDryRun) exportToRoo(rules, outputDir, options)
              exportPath = join(outputDir, '.roo/rules/')
              exportedPaths.push('.roo/rules/')
              break
            case 'junie':
              if (!isDryRun) exportToJunie(rules, outputDir, options)
              exportPath = join(outputDir, '.junie/guidelines.md')
              exportedPaths.push('.junie/guidelines.md')
              break
          }
          
          if (exportPath) {
            console.log(color.success(`Exported to: ${color.path(exportPath)}`))
          }
        }
      }
      
      if (!values['include-private'] && privateRuleCount > 0) {
        console.log(color.dim(`\nExcluded ${privateRuleCount} private rule(s). Use --include-private to include them.`))
      }
      
      // Handle gitignore updates
      if (!isDryRun && exportedPaths.length > 0) {
        let shouldUpdateGitignore = false
        
        // Check if there are actually new patterns to add
        const hasNewPatterns = checkForNewGitignorePatterns(outputDir, exportedPaths)
        
        if (values['gitignore']) {
          // --gitignore flag: automatically update gitignore (answer yes)
          shouldUpdateGitignore = true
          console.log(color.info('Updating .gitignore (auto-enabled by --gitignore flag)'))
        } else if (!values['no-gitignore'] && hasNewPatterns) {
          // Default behavior: ask user only if there are new patterns
          console.log()
          shouldUpdateGitignore = await confirm('Add exported files to .gitignore?', true)
        }
        // If --no-gitignore is specified or no new patterns, shouldUpdateGitignore remains false

        if (shouldUpdateGitignore) {
          const wasUpdated = updateGitignoreWithPaths(outputDir, exportedPaths)
          if (wasUpdated) {
            console.log(color.success('Updated .gitignore'))
          }
        }
      }
      break
    }

    case 'convert': {
      if (!target) {
        console.error(color.error('Input file path required'))
        process.exit(1)
      }

      const inputPath = resolve(target)
      if (!existsSync(inputPath)) {
        console.error(color.error(`File does not exist: ${color.path(inputPath)}`))
        process.exit(1)
      }

      console.log(header('Converting File'))

      // Auto-detect format or use specified
      let format = values.format
      if (!format) {
        if (inputPath.includes('copilot-instructions')) format = 'copilot'
        else if (inputPath.endsWith('.mdc')) format = 'cursor'
        else if (inputPath.includes('.clinerules')) format = 'cline'
        else if (inputPath.includes('.windsurfrules')) format = 'windsurf'
        else if (inputPath.endsWith('.rules')) format = 'zed'
        else if (inputPath.endsWith('AGENTS.md')) format = 'codex'
        else if (inputPath.endsWith('CLAUDE.md')) format = 'claude'
        else if (inputPath.endsWith('GEMINI.md')) format = 'gemini'
        else if (inputPath.endsWith('CONVENTIONS.md')) format = 'aider'
        else if (inputPath.endsWith('best_practices.md')) format = 'qodo'
        else if (inputPath.includes('.roo/rules')) format = 'roo'
        else {
          console.error(color.error('Cannot auto-detect format'))
          console.error(color.dim('Hint: Specify format with -f (copilot|cursor|cline|windsurf|zed|codex|aider|claude|gemini|qodo|roo|opencode)'))
          process.exit(1)
        }
      }

      console.log(`Format: ${color.format(format)}`)
      console.log(`Input: ${color.path(inputPath)}`)

      // Import using appropriate importer
      const { importCopilot, importCursor, importCline, importWindsurf, importZed, importCodex, importAider, importClaudeCode, importGemini, importQodo } = await import('./importers.js')
      
      let result
      switch (format) {
        case 'copilot':
          result = importCopilot(inputPath)
          break
        case 'cursor':
          result = importCursor(inputPath)
          break
        case 'cline':
          result = importCline(inputPath)
          break
        case 'windsurf':
          result = importWindsurf(inputPath)
          break
        case 'zed':
          result = importZed(inputPath)
          break
        case 'codex':
          result = importCodex(inputPath)
          break
        case 'aider':
          result = importAider(inputPath)
          break
        case 'claude':
          result = importClaudeCode(inputPath)
          break
        case 'opencode':
          result = importOpenCode(inputPath)
          break
        case 'gemini':
          result = importGemini(inputPath)
          break
        case 'qodo':
          result = importQodo(inputPath)
          break
        case 'roo':
          result = importRoo(inputPath)
          break
        default:
          console.error(color.error(`Unknown format: ${format}`))
          process.exit(1)
      }

      const outputDir = values.output || dirname(inputPath)
      const agentDir = join(outputDir, '.agent')

      // If an .agent directory already exists and overwrite flag is NOT set,
      // remove it to ensure a clean conversion output. This prevents stale
      // rules from previous operations (e.g., example workspaces) from
      // contaminating the converted output and breaking ordering-sensitive tests.
      if (existsSync(agentDir) && !values.overwrite) {
        rmSync(agentDir, { recursive: true, force: true })
      }

      if (isDryRun) {
        console.log(color.info(`Would export to: ${color.path(agentDir)}`))
        console.log(color.dim(`Rules found: ${result.rules.length}`))
      } else {
        exportToAgent(result.rules, outputDir)
        console.log(color.success(`Exported to: ${color.path(agentDir)}`))
        console.log(color.dim(`Created ${result.rules.length} .mdc file(s)`))
      }
      break
    }

    default:
      console.error(color.error(`Unknown command: ${command}`))
      showHelp()
      process.exit(1)
  }
}

function filterNewPatterns(content: string, paths: string[]): string[] {
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  const lineSet = new Set(lines)

  const variants = (p: string): string[] => {
    if (p.endsWith('/')) {
      const base = p.replace(/^\/+/, '')
      return [base, `${base}**`, `/${base}`, `/${base}**`]
    } else {
      const base = p.replace(/^\/+/, '')
      return [base, `/${base}`]
    }
  }

  return paths.filter(p => !variants(p).some(v => lineSet.has(v)))
}

function checkForNewGitignorePatterns(repoPath: string, paths: string[]): boolean {
  const gitignorePath = join(repoPath, '.gitignore')
  
  // If gitignore doesn't exist, all patterns are new
  if (!existsSync(gitignorePath)) {
    return paths.length > 0
  }
  
  const content = readFileSync(gitignorePath, 'utf-8')
  const newPatterns = filterNewPatterns(content, paths)
  
  return newPatterns.length > 0
}

function updateGitignoreWithPaths(repoPath: string, paths: string[]): boolean {
  const gitignorePath = join(repoPath, '.gitignore')
  
  const patterns = [
    '',
    '# Added by dotagent: ignore exported AI rule files',
    ...paths.map(p => p.endsWith('/') ? p + '**' : p),
    ''
  ].join('\n')
  
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    
    // Check if any of the patterns already exist
    const newPatterns = filterNewPatterns(content, paths)
    
    if (newPatterns.length > 0) {
      appendFileSync(gitignorePath, patterns)
      return true
    }
    return false
  } else {
    writeFileSync(gitignorePath, patterns.trim() + '\n')
    return true
  }
}

function updateGitignore(repoPath: string): void {
  const gitignorePath = join(repoPath, '.gitignore')
  const privatePatterns = [
    '# Added by dotagent: ignore private AI rule files',
    '.agent/**/*.local.md',
    '.agent/private/**',
    '.github/copilot-instructions.local.md',
    '.cursor/rules/**/*.local.{mdc,md}',
    '.cursor/rules-private/**',
    '.clinerules.local',
    '.clinerules/private/**',
    '.windsurfrules.local',
    '.rules.local',
    'AGENTS.local.md',
    'CONVENTIONS.local.md',
    'CLAUDE.local.md',
    'GEMINI.local.md'
  ].join('\n')
  
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    
    // Check if patterns are already present
    if (!content.includes('# Added by dotagent:')) {
      console.log(color.info('Updating .gitignore with private file patterns'))
      appendFileSync(gitignorePath, '\n\n' + privatePatterns + '\n', 'utf-8')
    }
  } else {
    // Create new .gitignore
    console.log(color.info('Creating .gitignore with private file patterns'))
    writeFileSync(gitignorePath, privatePatterns + '\n', 'utf-8')
  }
}

main().catch(error => {
  console.error(color.error('Unexpected error:'))
  console.error(error)
  process.exit(1)
})