import {
  importAll,
  toAgentMarkdown,
  parseAgentMarkdown,
  exportAll,
} from '../../src/index.js';

import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { describe, expect, it, afterAll } from 'vitest';

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), 'agentconfig-it-'));
}

function copyExampleWorkspace(tmp: string) {
  const exampleSrc = join(dirname(__dirname), '..', 'example');
  if (existsSync(exampleSrc)) {
    cpSync(exampleSrc, tmp, { recursive: true });
  } else {
    // Create a minimal example if the example directory doesn't exist
    const agentMd = `<!-- @meta
id: test-rule
alwaysApply: true
priority: high
-->

## Test Rule

This is a test rule for integration testing.

<!-- @pagebreak -->

<!-- @meta
id: another-rule
scope: src/**
-->

## Another Rule

Another test rule with scope.`;
    
    writeFileSync(join(tmp, '.agentconfig'), agentMd, 'utf8');
  }
}

describe('agentconfig integration – import ▶ convert ▶ export ▶ re‑import', () => {
  const tmp = makeTmp();
  copyExampleWorkspace(tmp);

  afterAll(() => {
    // Clean up – comment this out if you want to inspect the artifacts
    rmSync(tmp, { recursive: true, force: true });
  });

  it('performs a round-trip conversion', async () => {
    /* ---------------- 1. IMPORT EXISTING RULE FILES ---------------- */
    const import1 = await importAll(tmp);
    let rules1 = import1.results.flatMap(r => r.rules);

    // If no rules found (no example files), parse the .agentconfig we created
    if (rules1.length === 0 && existsSync(join(tmp, '.agentconfig'))) {
      const content = readFileSync(join(tmp, '.agentconfig'), 'utf8');
      rules1 = parseAgentMarkdown(content);
    }

    expect(rules1.length).toBeGreaterThan(0);

    /* ---------------- 2. WRITE UNIFIED .agentconfig ------------------- */
    const agentMd = toAgentMarkdown(rules1);
    const agentPath = join(tmp, '.agentconfig-generated');
    writeFileSync(agentPath, agentMd, 'utf8');

    /* ---------------- 3. PARSE THE GENERATED FILE ------------------ */
    const parsedBack = parseAgentMarkdown(readFileSync(agentPath, 'utf8'));
    expect(parsedBack).toEqual(rules1);

    /* ---------------- 4. EXPORT TO ALL FORMATS --------------------- */
    const outDir = join(tmp, 'exported');
    exportAll(parsedBack, outDir);

    /* Quick smoke-check the export produced something we expect */
    const copilotFile = join(outDir, '.github', 'copilot-instructions.md');
    expect(existsSync(copilotFile)).toBe(true);
    expect(readFileSync(copilotFile, 'utf8').length).toBeGreaterThan(10);

    /* ---------------- 5. RE-IMPORT FROM EXPORTS -------------------- */
    const import2 = await importAll(outDir);
    
    // Find the format that preserves individual rules best (Cursor)
    const cursorImport = import2.results.find(r => r.format === 'cursor');
    
    /* ---------------- 6. VERIFY CURSOR PRESERVES RULES ------------- */
    // Cursor should preserve all individual rules
    if (cursorImport) {
      expect(cursorImport.rules.length).toBe(rules1.length);
      
      const sortedRules1 = [...rules1].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
      const sortedRules2 = [...cursorImport.rules].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
      
      // Check that each rule's content matches
      sortedRules1.forEach((rule1, index) => {
        const rule2 = sortedRules2[index];
        expect(rule2.metadata.id).toBe(rule1.metadata.id);
        expect(rule2.content.trim()).toBe(rule1.content.trim());
      });
    }
    
    /* ---------------- 7. VERIFY ALL FORMATS EXPORTED ---------------- */
    const formats = import2.results.map(r => r.format).sort();
    expect(formats).toContain('copilot');
    expect(formats).toContain('cursor');
    expect(formats).toContain('cline');
    expect(formats).toContain('windsurf');
    expect(formats).toContain('zed');
    expect(formats).toContain('codex');
  });

  it('handles multiple rule types correctly', async () => {
    const complexRules = [
      {
        metadata: {
          id: 'always-rule',
          alwaysApply: true,
          priority: 'high' as const,
          description: 'Always applied rule'
        },
        content: '# Always Rule\n\nThis rule is always applied.'
      },
      {
        metadata: {
          id: 'scoped-rule',
          scope: ['src/**/*.ts', 'test/**/*.ts'],
          manual: false
        },
        content: '# Scoped Rule\n\nThis rule applies to TypeScript files.'
      },
      {
        metadata: {
          id: 'manual-rule',
          manual: true,
          triggers: ['@file-change']
        },
        content: '# Manual Rule\n\nThis rule is manually triggered.'
      }
    ];

    // Write to .agentconfig
    const agentMd = toAgentMarkdown(complexRules);
    const testPath = join(tmp, 'complex-test.agentconfig');
    writeFileSync(testPath, agentMd, 'utf8');

    // Parse back
    const parsed = parseAgentMarkdown(readFileSync(testPath, 'utf8'));
    
    // Verify all metadata is preserved
    expect(parsed.length).toBe(3);
    expect(parsed[0].metadata.alwaysApply).toBe(true);
    expect(parsed[0].metadata.priority).toBe('high');
    expect(parsed[1].metadata.scope).toEqual(['src/**/*.ts', 'test/**/*.ts']);
    expect(parsed[2].metadata.manual).toBe(true);
    expect(parsed[2].metadata.triggers).toEqual(['@file-change']);
  });
});