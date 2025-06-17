#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { parseArgs } from 'util'
import { importAll, toAgentMarkdown, exportAll, parseAgentMarkdown } from './index.js'
import { color, header, formatList } from './utils/colors.js'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
    output: { type: 'string', short: 'o' },
    format: { type: 'string', short: 'f' },
    overwrite: { type: 'boolean', short: 'w' },
    'dry-run': { type: 'boolean', short: 'd' },
  },
  allowPositionals: true
})

function showHelp() {
  console.log(`
${color.bold('agentconfig')} - Universal AI agent configuration tool

${color.bold('Usage:')}
  ${color.command('agentconfig import')} ${color.dim('<repo-path>')}    Import all rule files from a repository
  ${color.command('agentconfig export')} ${color.dim('[file]')}         Export .agentconfig to all supported formats
  ${color.command('agentconfig convert')} ${color.dim('<file>')}        Convert a specific rule file to .agentconfig

${color.bold('Options:')}
  ${color.yellow('-h, --help')}       Show this help message
  ${color.yellow('-o, --output')}     Output file path (for convert command)
  ${color.yellow('-f, --format')}     Specify format (copilot|cursor|cline|windsurf|zed|codex|aider)
  ${color.yellow('-w, --overwrite')}  Overwrite existing files
  ${color.yellow('-d, --dry-run')}    Preview operations without making changes

${color.bold('Examples:')}
  ${color.dim('# Import all rules from current directory')}
  ${color.command('agentconfig import .')}

  ${color.dim('# Convert a specific file to .agentconfig')}
  ${color.command('agentconfig convert .github/copilot-instructions.md -o .agentconfig')}

  ${color.dim('# Export .agentconfig to all formats (uses .agentconfig in current dir)')}
  ${color.command('agentconfig export')}
  
  ${color.dim('# Export a specific file')}
  ${color.command('agentconfig export my-rules.agentconfig')}

  ${color.dim('# Preview what would be imported without creating files')}
  ${color.command('agentconfig import . --dry-run')}
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
      if (!target) {
        console.error(color.error('Repository path required'))
        console.error(color.dim('Hint: Use "." for current directory'))
        process.exit(1)
      }

      const repoPath = resolve(target)
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
        console.log(color.dim('Hint: AgentConfig looks for:'))
        console.log(formatList([
          '.github/copilot-instructions.md',
          '.cursor/rules/*.mdc',
          '.clinerules',
          '.windsurfrules',
          '.rules',
          'AGENTS.md'
        ]))
      } else {
        console.log(color.success(`Found ${color.number(results.length.toString())} rule file(s):`))
        
        for (const result of results) {
          const ruleCount = color.number(`${result.rules.length} rule(s)`)
          console.log(`  ${color.format(result.format)}: ${color.path(result.filePath)} ${color.dim(`(${ruleCount})`)}`)
        }

        // Combine all rules
        const allRules = results.flatMap(r => r.rules)
        const agentMd = toAgentMarkdown(allRules)

        const outputPath = values.output || join(repoPath, '.agentconfig')
        
        if (existsSync(outputPath) && !values.overwrite && !isDryRun) {
          console.error(color.error(`${color.path(outputPath)} already exists`))
          console.error(color.dim('Hint: Use -w to overwrite or -o to specify a different output file'))
          process.exit(1)
        }

        if (isDryRun) {
          console.log(color.info(`Would create: ${color.path(outputPath)}`))
          console.log(color.dim(`File size: ~${Math.round(agentMd.length / 1024)}KB`))
          console.log(color.dim(`Total rules: ${allRules.length}`))
        } else {
          writeFileSync(outputPath, agentMd, 'utf-8')
          console.log(color.success(`Created unified configuration: ${color.path(outputPath)}`))
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
      // Default to .agentconfig in current directory if no target specified
      const filePath = target ? resolve(target) : resolve('.agentconfig')
      
      if (!existsSync(filePath)) {
        console.error(color.error(`File does not exist: ${color.path(filePath)}`))
        if (!target) {
          console.error(color.dim('Hint: No .agentconfig file found in current directory'))
        }
        console.error(color.dim('Hint: Run "agentconfig import ." first to create .agentconfig'))
        process.exit(1)
      }

      console.log(header('Exporting Rules'))
      
      const content = readFileSync(filePath, 'utf-8')
      const rules = parseAgentMarkdown(content)
      
      console.log(color.success(`Parsed ${color.number(rules.length.toString())} rule(s) from ${color.path(filePath)}`))

      const outputDir = values.output || process.cwd()
      
      const exportTargets = [
        { path: '.github/copilot-instructions.md', format: 'VS Code Copilot' },
        { path: '.cursor/rules/', format: 'Cursor' },
        { path: '.clinerules', format: 'Cline' },
        { path: '.windsurfrules', format: 'Windsurf' },
        { path: '.rules', format: 'Zed' },
        { path: 'AGENTS.md', format: 'OpenAI Codex' },
        { path: 'CONVENTIONS.md', format: 'Aider' }
      ]

      if (isDryRun) {
        console.log(color.info('Would export to:'))
        for (const target of exportTargets) {
          console.log(`  ${color.format(target.format)}: ${color.path(join(outputDir, target.path))}`)
        }
      } else {
        exportAll(rules, outputDir, isDryRun)
        console.log(color.success('Exported to:'))
        for (const target of exportTargets) {
          console.log(`  ${color.format(target.format)}: ${color.path(join(outputDir, target.path))}`)
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
        else {
          console.error(color.error('Cannot auto-detect format'))
          console.error(color.dim('Hint: Specify format with -f (copilot|cursor|cline|windsurf|zed|codex|aider)'))
          process.exit(1)
        }
      }

      console.log(`Format: ${color.format(format)}`)
      console.log(`Input: ${color.path(inputPath)}`)

      // Import using appropriate importer
      const { importCopilot, importCursor, importCline, importWindsurf, importZed, importCodex } = await import('./importers.js')
      
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
        case 'aider':
          result = importCodex(inputPath)
          break
        default:
          console.error(color.error(`Unknown format: ${format}`))
          process.exit(1)
      }

      const agentMd = toAgentMarkdown(result.rules)
      const outputPath = values.output || inputPath.replace(/\.[^.]+$/, '.agentconfig')

      if (existsSync(outputPath) && !values.overwrite && !isDryRun) {
        console.error(color.error(`${color.path(outputPath)} already exists`))
        console.error(color.dim('Hint: Use -w to overwrite'))
        process.exit(1)
      }

      if (isDryRun) {
        console.log(color.info(`Would create: ${color.path(outputPath)}`))
        console.log(color.dim(`Rules found: ${result.rules.length}`))
        console.log(color.dim(`Output size: ~${Math.round(agentMd.length / 1024)}KB`))
      } else {
        writeFileSync(outputPath, agentMd, 'utf-8')
        console.log(color.success(`Created: ${color.path(outputPath)}`))
      }
      break
    }

    default:
      console.error(color.error(`Unknown command: ${command}`))
      showHelp()
      process.exit(1)
  }
}

main().catch(error => {
  console.error(color.error('Unexpected error:'))
  console.error(error)
  process.exit(1)
})