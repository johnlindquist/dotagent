import yaml from 'js-yaml'
import type { GrayMatterOption } from 'gray-matter'

/**
 * Custom YAML parser that handles glob patterns starting with *
 * by pre-processing the YAML to quote unquoted strings that start with *
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
    stringify: (data: object) => yaml.dump(data)
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