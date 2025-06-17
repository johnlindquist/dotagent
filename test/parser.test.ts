import { describe, it, expect } from 'vitest'
import { parseAgentMarkdown } from '../src/parser.js'

describe('parseAgentMarkdown', () => {
  it('should parse HTML-directive markdown with single rule', () => {
    const markdown = `
<!-- @test-rule
alwaysApply: true
-->

## Test Rule

This is a test rule content.
`

    const rules = parseAgentMarkdown(markdown)
    
    expect(rules).toHaveLength(1)
    expect(rules[0].metadata.id).toBe('test-rule')
    expect(rules[0].metadata.alwaysApply).toBe(true)
    expect(rules[0].content).toContain('## Test Rule')
    expect(rules[0].content).toContain('This is a test rule content.')
  })

  it('should parse multiple rules with @<id> as implicit separator', () => {
    const markdown = `
<!-- @rule1
priority: high
-->

First rule content

<!-- @rule2
priority: low
-->

Second rule content
`

    const rules = parseAgentMarkdown(markdown)
    
    expect(rules).toHaveLength(2)
    expect(rules[0].metadata.id).toBe('rule1')
    expect(rules[0].metadata.priority).toBe('high')
    expect(rules[1].metadata.id).toBe('rule2')
    expect(rules[1].metadata.priority).toBe('low')
  })

  it('should parse inline key:value metadata', () => {
    const markdown = `
<!-- @inline-rule scope:src/api/** manual:true -->

Inline metadata rule
`

    const rules = parseAgentMarkdown(markdown)
    
    expect(rules).toHaveLength(1)
    expect(rules[0].metadata.id).toBe('inline-rule')
    expect(rules[0].metadata.scope).toBe('src/api/**')
    expect(rules[0].metadata.manual).toBe(true)
  })

  it('should handle empty rules array when no metadata found', () => {
    const markdown = `
# Just some content

Without any @<id> directives
`

    const rules = parseAgentMarkdown(markdown)
    expect(rules).toHaveLength(0)
  })
})