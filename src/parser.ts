import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { toMarkdown } from 'mdast-util-to-markdown'
import yaml from 'js-yaml'
import type { Root, RootContent } from 'mdast'
import type { RuleBlock, RuleMetadata, ParserOptions } from './types.js'

/**
 * @deprecated Use importAgent() instead. Single-file .agentconfig format is deprecated.
 */
export function parseAgentMarkdown(
  markdown: string,
  options: ParserOptions = {}
): RuleBlock[] {
  console.warn('Warning: parseAgentMarkdown() is deprecated. Use importAgent() to import from .agent/ directory instead.')
  const processor = unified().use(remarkParse)
  const tree = processor.parse(markdown) as Root

  const rules: RuleBlock[] = []
  let currentMetadata: RuleMetadata | null = null
  let currentContent: RootContent[] = []
  let currentPosition: RuleBlock['position'] | undefined

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]

    // Check for HTML comment with @<id> directive
    if (node.type === 'html' && isRuleComment(node.value)) {
      // If we have accumulated content, save the previous rule
      if (currentMetadata && currentContent.length > 0) {
        rules.push({
          metadata: currentMetadata,
          content: nodesToMarkdown(currentContent),
          position: currentPosition
        })
      }

      // Parse the new metadata
      currentMetadata = parseRuleComment(node.value)
      currentContent = []
      currentPosition = node.position ? {
        start: { ...node.position.start },
        end: { ...node.position.end }
      } : undefined
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

function isRuleComment(html: string): boolean {
  // Check if it contains @<id> pattern (@ followed by alphanumeric and hyphens)
  return /<!--\s*@[a-zA-Z0-9-]+(\s|$)/.test(html)
}

function parseRuleComment(html: string): RuleMetadata {
  // Extract @<id> and any additional metadata
  const match = html.match(/<!--\s*@([a-zA-Z0-9-]+)\s*([\s\S]*?)\s*-->/)
  if (!match) {
    throw new Error('Invalid rule comment format')
  }

  const id = match[1]
  const metaContent = match[2].trim()

  // Start with the ID from the @<id> pattern
  const metadata: RuleMetadata = { id }

  // If there's no additional content, return just the ID
  if (!metaContent) {
    return metadata
  }

  // Check if it looks like YAML (has newlines or starts with a YAML indicator)
  if (metaContent.includes('\n') || metaContent.startsWith('-') || metaContent.includes(': ')) {
    // Try to parse as YAML
    try {
      const parsed = yaml.load(metaContent) as Record<string, unknown>
      if (typeof parsed === 'object' && parsed !== null) {
        // Merge with existing metadata, but preserve the ID from @<id>
        return { ...parsed, id } as RuleMetadata
      }
    } catch {
      // Fall through to key:value parsing
    }
  }

  // Parse as key:value pairs
  // First check if it's all on one line (inline format)
  if (!metaContent.includes('\n')) {
    // Inline format: key:value pairs separated by spaces
    const pairs = metaContent.matchAll(/(\w+):(\S+)(?:\s|$)/g);
    for (const [, key, value] of pairs) {
      // Skip 'id' since we already have it from @<id>
      if (key === 'scope' && value.includes(',')) {
        metadata[key] = value.split(',').map(s => s.trim())
      } else if (key === 'alwaysApply' || key === 'manual') {
        metadata[key] = value === 'true'
      } else if (key !== 'id') {
        metadata[key] = value
      }
    }
  } else {
    // Multi-line format: one key:value per line
    const lines = metaContent.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        // Skip 'id' since we already have it from @<id>
        if (key === 'scope' && value.includes(',')) {
          metadata[key] = value.split(',').map(s => s.trim())
        } else if (key === 'alwaysApply' || key === 'manual') {
          metadata[key] = value === 'true'
        } else if (key !== 'id' && value) {
          metadata[key] = value
        }
      }
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