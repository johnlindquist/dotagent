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
      const yamlOutput = yaml.dump(data)
      const lines = yamlOutput.split(/\r?\n/)
      const out: string[] = []
      let inGlobsArray = false
      let globsIndent = ''
      const containsGlob = (s: string) => s.includes('*')

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i]

        // Detect the globs key
        const globsMatch = line.match(/^(\s*)globs:\s*(.*)$/)
        if (globsMatch) {
          globsIndent = globsMatch[1]
          const value = globsMatch[2]

          // Array style begins on next lines
          if (value === '') {
            inGlobsArray = true
            out.push(line)
            continue
          }

          // Scalar style on same line: globs: "..."
          const scalar = value.match(/^(['"])(.+)\1(\s*(?:#.*)?)$/)
          if (scalar && containsGlob(scalar[2])) {
            line = `${globsIndent}globs: ${scalar[2]}${scalar[3] ?? ''}`
          }
          out.push(line)
          continue
        }

        if (inGlobsArray) {
          // End of the globs array when we dedent
          if (!line.startsWith(globsIndent + '  ')) {
            inGlobsArray = false
            i-- // reprocess this line outside array handling
            continue
          }
          // Sequence item: - "..."
          const item = line.match(/^(\s*-\s*)(['"])(.+)\2(\s*(?:#.*)?)$/)
          if (item && containsGlob(item[3])) {
            line = `${item[1]}${item[3]}${item[4] ?? ''}`
          }
          out.push(line)
          continue
        }

        out.push(line)
      }
      return out.join('\n')
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