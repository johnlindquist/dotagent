import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { toMarkdown } from 'mdast-util-to-markdown'
import yaml from 'js-yaml'
import type { Root, RootContent } from 'mdast'
import type { RuleBlock, RuleMetadata, ParserOptions } from './types.js'

export function parseAgentMarkdown(
  markdown: string,
  options: ParserOptions = {}
): RuleBlock[] {
  const processor = unified().use(remarkParse)
  const tree = processor.parse(markdown) as Root

  const rules: RuleBlock[] = []
  let currentMetadata: RuleMetadata | null = null
  let currentContent: RootContent[] = []
  let currentPosition: RuleBlock['position'] | undefined

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]

    // Check for HTML comment with @meta directive
    if (node.type === 'html' && isMetaComment(node.value)) {
      // If we have accumulated content, save the previous rule
      if (currentMetadata && currentContent.length > 0) {
        rules.push({
          metadata: currentMetadata,
          content: nodesToMarkdown(currentContent),
          position: currentPosition
        })
      }

      // Parse the new metadata
      currentMetadata = parseMetaComment(node.value)
      currentContent = []
      currentPosition = node.position ? {
        start: { ...node.position.start },
        end: { ...node.position.end }
      } : undefined
    }
    // Check for @pagebreak directive
    else if (node.type === 'html' && node.value.includes('@pagebreak')) {
      // Save current rule if exists
      if (currentMetadata && currentContent.length > 0) {
        rules.push({
          metadata: currentMetadata,
          content: nodesToMarkdown(currentContent),
          position: currentPosition
        })
      }
      currentMetadata = null
      currentContent = []
      currentPosition = undefined
    }
    // Accumulate content
    else if (currentMetadata) {
      currentContent.push(node)
      if (currentPosition && node.position) {
        currentPosition.end = { ...node.position.end }
      }
    }
  }

  // Don't forget the last rule
  if (currentMetadata && currentContent.length > 0) {
    rules.push({
      metadata: currentMetadata,
      content: nodesToMarkdown(currentContent),
      position: currentPosition
    })
  }

  return rules
}

function isMetaComment(html: string): boolean {
  return html.includes('@meta')
}

function parseMetaComment(html: string): RuleMetadata {
  // Extract content between <!-- @meta and -->
  const match = html.match(/<!--\s*@meta\s+([\s\S]*?)\s*-->/)
  if (!match) {
    throw new Error('Invalid @meta comment format')
  }

  const metaContent = match[1].trim()

  // Check if it looks like YAML (has newlines or starts with a YAML indicator)
  if (metaContent.includes('\n') || metaContent.startsWith('-') || metaContent.includes(': ')) {
    // Try to parse as YAML
    try {
      const parsed = yaml.load(metaContent) as Record<string, unknown>
      if (!parsed.id && typeof parsed === 'object' && parsed !== null) {
        // Generate ID from first key or random
        parsed.id = Object.keys(parsed)[0] || `rule-${Date.now()}`
      }
      return parsed as RuleMetadata
    } catch {
      // Fall through to key:value parsing
    }
  }

  // Parse as key:value pairs
  const metadata: RuleMetadata = { id: `rule-${Date.now()}` }

  // Match key:value pairs - simpler regex
  const pairs = metaContent.matchAll(/(\w+):([^\s]+)/g)
  for (const [, key, value] of pairs) {
    const trimmedValue = value.trim()
    if (key === 'id') {
      metadata.id = trimmedValue
    } else if (key === 'scope' && trimmedValue.includes(',')) {
      metadata[key] = trimmedValue.split(',').map(s => s.trim())
    } else if (key === 'alwaysApply' || key === 'manual') {
      metadata[key] = trimmedValue === 'true'
    } else {
      metadata[key] = trimmedValue
    }
  }

  return metadata
}

function nodesToMarkdown(nodes: RootContent[]): string {
  const tree: Root = {
    type: 'root',
    children: nodes
  }

  return toMarkdown(tree, {
    bullet: '-',
    emphasis: '*',
    rule: '-'
  }).trim()
}

// Alternative parser for fence-encoded format
export function parseFenceEncodedMarkdown(
  markdown: string,
  options: ParserOptions = {}
): RuleBlock[] {
  const processor = unified().use(remarkParse)
  const tree = processor.parse(markdown) as Root

  const rules: RuleBlock[] = []
  let currentMetadata: RuleMetadata | null = null
  let currentContent: RootContent[] = []
  let currentPosition: RuleBlock['position'] | undefined

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]

    // Check for code block with 'rule' language
    if (node.type === 'code' && node.lang === 'rule') {
      // Save previous rule if exists
      if (currentMetadata && currentContent.length > 0) {
        rules.push({
          metadata: currentMetadata,
          content: nodesToMarkdown(currentContent),
          position: currentPosition
        })
      }

      // Parse the rule metadata
      try {
        currentMetadata = yaml.load(node.value) as RuleMetadata
        if (!currentMetadata.id) {
          currentMetadata.id = `rule-${Date.now()}`
        }
        currentContent = []
        currentPosition = node.position ? {
          start: { ...node.position.start },
          end: { ...node.position.end }
        } : undefined
      } catch (e) {
        if (options.strict) {
          throw new Error(`Failed to parse rule metadata: ${e}`)
        }
        // Skip invalid rule blocks in non-strict mode
        currentMetadata = null
      }
    }
    // Accumulate content after rule block
    else if (currentMetadata) {
      currentContent.push(node)
      if (currentPosition && node.position) {
        currentPosition.end = { ...node.position.end }
      }
    }
  }

  // Don't forget the last rule
  if (currentMetadata && currentContent.length > 0) {
    rules.push({
      metadata: currentMetadata,
      content: nodesToMarkdown(currentContent),
      position: currentPosition
    })
  }

  return rules
}