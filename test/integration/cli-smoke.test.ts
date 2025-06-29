import { execa } from 'execa';
import { join, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

function setupTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'agentconfig-cli-'));
  const example = join(dirname(__dirname), '..', 'example');
  
  if (existsSync(example)) {
    cpSync(example, d, { recursive: true });
  } else {
    // Create minimal test data in .agent directory
    const agentDir = join(d, '.agent');
    const { mkdirSync } = require('fs');
    mkdirSync(agentDir, { recursive: true });
    const testAgent = `---
id: cli-test
alwaysApply: true
---

## CLI Test Rule

This is a test rule for CLI testing.`;
    writeFileSync(join(agentDir, 'cli-test.md'), testAgent, 'utf8');
  }
  
  return d;
}

describe('CLI smoke tests', () => {
  it('import command creates a .agent/ directory', async () => {
    const dir = setupTmp();
    try {
      const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

      // First create some rule files to import
      writeFileSync(join(dir, '.rules'), '# Zed Rules\n\nTest rules for Zed', 'utf8');

      const result = await execa('node', [cliPath, 'import', dir, '-w'], {
        cwd: dir,
      });

      expect(result.exitCode).toBe(0);
      
      const agentDir = join(dir, '.agent');
      expect(existsSync(agentDir)).toBe(true);
      
      const files = require('fs').readdirSync(agentDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.env.CI)('export command with dry-run does not create files', async () => {
    const dir = setupTmp();
    try {
      const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

      // Remove legacy .agentconfig if it exists
      const agentConfigPath = join(dir, '.agentconfig');
      if (existsSync(agentConfigPath)) {
        rmSync(agentConfigPath, { force: true });
      }
      
      // Create .agent directory with a test rule
      const agentDir = join(dir, '.agent');
      const { mkdirSync } = require('fs');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'test-rule.md'), '---\nid: test-rule\n---\n\n# Test Rule', 'utf8');
      
      // Remove any existing rule files that may have been copied from example
      const rulesToRemove = ['.github/copilot-instructions.md', '.rules', '.clinerules', '.windsurfrules', 'AGENTS.md', 'CONVENTIONS.md'];
      for (const rule of rulesToRemove) {
        const fullPath = join(dir, rule);
        if (existsSync(fullPath)) {
          rmSync(fullPath, { force: true });
        }
      }
      
      // Remove .github directory if empty
      const githubDir = join(dir, '.github');
      if (existsSync(githubDir)) {
        rmSync(githubDir, { recursive: true, force: true });
      }

      const result = await execa('node', [cliPath, 'export', dir, '--dry-run'], {
        cwd: dir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('dry-run mode');
      expect(result.stdout).toContain('Would export to:');
      
      // Verify no files were created
      expect(existsSync(join(dir, '.github', 'copilot-instructions.md'))).toBe(false);
      expect(existsSync(join(dir, '.rules'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('convert command works with format detection', async () => {
    const dir = setupTmp();
    try {
      const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

      // Create a copilot instructions file
      const copilotPath = join(dir, '.github', 'copilot-instructions.md');
      const copilotDir = dirname(copilotPath);
      if (!existsSync(copilotDir)) {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(copilotDir, { recursive: true });
      }
      writeFileSync(copilotPath, '# Copilot Instructions\n\nUse TypeScript everywhere', 'utf8');

      const result = await execa('node', [cliPath, 'convert', copilotPath], {
        cwd: dir,
      });

      expect(result.exitCode).toBe(0);
      
      const agentDir = join(dirname(copilotPath), '.agent');
      expect(existsSync(agentDir)).toBe(true);
      
      const files = require('fs').readdirSync(agentDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBeGreaterThan(0);
      
      const content = readFileSync(join(agentDir, files[0]), 'utf8');
      expect(content).toContain('Use TypeScript everywhere');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shows helpful error messages', async () => {
    const dir = setupTmp();
    try {
      const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

      const result = await execa('node', [cliPath, 'import', '/nonexistent/path'], {
        cwd: dir,
        reject: false,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Path does not exist');
      expect(result.stderr).toContain('Hint:');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles help flag correctly', async () => {
    const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

    const result = await execa('node', [cliPath, '--help'], {});

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('dotagent');
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Options:');
    expect(result.stdout).toContain('Examples:');
  });
});