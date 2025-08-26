import yaml from 'js-yaml'
import type { GrayMatterOption } from 'gray-matter'

/**
 * Custom YAML parser that handles glob patterns starting with *
 * by pre-processing the YAML to quote unquoted strings that start with * during parsing
 * and removing quotes from glob patterns during stringification
 */
export function createSafeYamlParser() {
  return {
    parse: (str: string): object => {
      // Pre-process the YAML string to quote glob patterns
      // This regex looks for unquoted strings starting with * in YAML values
      const processedStr = str.replace(
        /^(\s*\w+:\s*)(\*[^\n\r"']*?)(\s*(?:\r?\n|$))/gm,
        (match, prefix, value, suffix) => {
          // Check if the value is already quoted
          if (value.startsWith('"') || value.startsWith("'")) {
            return match
          }
          // Quote the value to prevent it from being interpreted as a YAML alias
          return `${prefix}"${value}"${suffix}`
        }
      )
      
      // Also handle array items that start with *
      const fullyProcessedStr = processedStr.replace(
        /^(\s*-\s+)(\*[^\n\r"']*?)(\s*(?:\r?\n|$))/gm,
        (match, prefix, value, suffix) => {
          // Check if the value is already quoted
          if (value.startsWith('"') || value.startsWith("'")) {
            return match
          }
          // Quote the value
          return `${prefix}"${value}"${suffix}`
        }
      )
      
      try {
        return yaml.load(fullyProcessedStr) as object
      } catch (error) {
        // If preprocessing fails, try the original string
        return yaml.load(str) as object
      }
    },
    stringify: (data: object) => {
      // First, dump with default options
      const yamlOutput = yaml.dump(data)
      
      // Post-process to remove quotes from glob patterns for universal compatibility
      return yamlOutput
        // Remove quotes from simple glob patterns like "*.ts" or '*.ts' -> *.ts
        .replace(/^(\s*globs:\s*)(['"])(\*[^'"]*)\2$/gm, '$1$3')
        // Remove quotes from comma-separated globs like "*.tsx,*.ts" -> *.tsx,*.ts
        .replace(/^(\s*globs:\s*)(['"])([^'"]*\*[^'"]*(?:,[^'"]*\*[^'"]*)*)\2$/gm, '$1$3')
        // Remove quotes from array items like '- "*.tsx"' or "- '*.tsx'" -> '- *.tsx'
        .replace(/^(\s*-\s*)(['"])(\*[^'"]*)\2$/gm, '$1$3')
        // Handle complex patterns like "**/*.{ts,tsx}" or '**/*.{ts,tsx}' -> **/*.{ts,tsx}
        .replace(/^(\s*globs:\s*)(['"])(\*\*?\/[^'"]*)\2$/gm, '$1$3')
        .replace(/^(\s*-\s*)(['"])(\*\*?\/[^'"]*)\2$/gm, '$1$3')
    }
  }
}

/**
 * Gray-matter options with custom YAML parser for handling glob patterns
 */
export const grayMatterOptions: GrayMatterOption<string, object> = {
  engines: {
    yaml: createSafeYamlParser()
  }
}