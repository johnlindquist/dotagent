import {
  importAll,
  importAgent,
  exportToAgent,
  exportAll,
} from '../../src/index.js';
import type { RuleBlock } from '../../src/types.js';

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
    const agentDir = join(tmp, '.agent');
    const { mkdirSync } = require('fs');
    mkdirSync(agentDir, { recursive: true });
    
    writeFileSync(join(agentDir, 'test-rule.md'), `---
id: test-rule
alwaysApply: true
priority: high
---

## Test Rule

This is a test rule for integration testing.`, 'utf8');
    
    writeFileSync(join(agentDir, 'another-rule.md'), `---
id: another-rule
scope: src/**
---

## Another Rule

Another test rule with scope.`, 'utf8');
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

    // If no rules found from other formats, check .agent directory
    if (rules1.length === 0 && existsSync(join(tmp, '.agent'))) {
      const agentImport = importAgent(join(tmp, '.agent'));
      rules1 = agentImport.rules;
    }

    expect(rules1.length).toBeGreaterThan(0);

    /* ---------------- 2. EXPORT TO .agent/ DIRECTORY ------------------- */
    const exportDir = join(tmp, 'test-export');
    exportToAgent(rules1, exportDir);

    /* ---------------- 3. RE-IMPORT FROM .agent/ DIRECTORY -------------- */
    const reimport = importAgent(join(exportDir, '.agent'));
    const parsedBack = reimport.rules;
    
    // Remove position information for comparison (it's added during parsing)
    // Sort by ID to ensure consistent comparison since order is not guaranteed
    const normalizeRules = (rules: RuleBlock[]) =>
      rules
        .map(r => ({ metadata: r.metadata, content: r.content }))
        .sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
    
    expect(normalizeRules(parsedBack)).toEqual(normalizeRules(rules1));

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
    // Cursor should preserve all non-private rules
    if (cursorImport) {
      // Filter out private rules from rules1 for comparison
      const nonPrivateRules1 = rules1.filter(r => !r.metadata.private);
      expect(cursorImport.rules.length).toBe(nonPrivateRules1.length);
      
      const sortedRules1 = [...nonPrivateRules1].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
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
    expect(formats).toContain('agent');
    expect(formats).toContain('claude');
    expect(formats).toContain('copilot');
    expect(formats).toContain('cursor');
    expect(formats).toContain('cline');
    expect(formats).toContain('windsurf');
    expect(formats).toContain('zed');
    expect(formats).toContain('codex');
    expect(formats).toContain('amazonq');
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

    // Write to .agent directory
    const complexDir = join(tmp, 'complex-test');
    exportToAgent(complexRules, complexDir);

    // Parse back
    const reimport = importAgent(join(complexDir, '.agent'));
    const parsed = reimport.rules;
    
    // Verify all metadata is preserved
    expect(parsed.length).toBe(3);
    
    // Sort by ID to ensure consistent order
    const sortedParsed = [...parsed].sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
    const alwaysRule = sortedParsed.find(r => r.metadata.id === 'always-rule');
    const scopedRule = sortedParsed.find(r => r.metadata.id === 'scoped-rule');
    const manualRule = sortedParsed.find(r => r.metadata.id === 'manual-rule');
    
    expect(alwaysRule?.metadata.alwaysApply).toBe(true);
    expect(alwaysRule?.metadata.priority).toBe('high');
    expect(scopedRule?.metadata.scope).toEqual(['src/**/*.ts', 'test/**/*.ts']);
    expect(manualRule?.metadata.manual).toBe(true);
    expect(manualRule?.metadata.triggers).toEqual(['@file-change']);
  });
});