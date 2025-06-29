import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'
import { grayMatterOptions } from '../src/yaml-parser'

describe('Custom YAML parser for glob patterns', () => {
  it('should parse glob patterns starting with * without treating them as aliases', () => {
    const content = `---
description: React component rules
globs: *.tsx
alwaysApply: false
---

# React Rules`

    const { data, content: body } = matter(content, grayMatterOptions)
    
    expect(data.description).toBe('React component rules')
    expect(data.globs).toBe('*.tsx')
    expect(data.alwaysApply).toBe(false)
  })

  it('should parse multiple glob patterns with asterisks', () => {
    const content = `---
globs: *.tsx,src/**/*.ts,**/*.json
---

Content`

    const { data } = matter(content, grayMatterOptions)
    expect(data.globs).toBe('*.tsx,src/**/*.ts,**/*.json')
  })

  it('should handle array of glob patterns starting with asterisks', () => {
    const content = `---
globs:
  - *.tsx
  - **/*.ts
  - src/**/*.js
---

Content`

    const { data } = matter(content, grayMatterOptions)
    expect(Array.isArray(data.globs)).toBe(true)
    expect(data.globs).toEqual(['*.tsx', '**/*.ts', 'src/**/*.js'])
  })

  it('should preserve already quoted values', () => {
    const content = `---
globs: "*.tsx"
other: '**/*.js'
---

Content`

    const { data } = matter(content, grayMatterOptions)
    expect(data.globs).toBe('*.tsx')
    expect(data.other).toBe('**/*.js')
  })

  it('should handle mixed quoted and unquoted values', () => {
    const content = `---
pattern1: *.tsx
pattern2: "*.js"
pattern3: src/**/*.ts
---

Content`

    const { data } = matter(content, grayMatterOptions)
    expect(data.pattern1).toBe('*.tsx')
    expect(data.pattern2).toBe('*.js')
    expect(data.pattern3).toBe('src/**/*.ts')
  })

  it('should stringify back correctly', () => {
    const data = {
      globs: '*.tsx,**/*.ts',
      description: 'Test rule'
    }
    const content = 'Rule content here'

    const result = matter.stringify(content, data, grayMatterOptions)
    
    // Parse it back to verify round-trip
    const { data: parsedData } = matter(result, grayMatterOptions)
    expect(parsedData.globs).toBe('*.tsx,**/*.ts')
    expect(parsedData.description).toBe('Test rule')
  })
})