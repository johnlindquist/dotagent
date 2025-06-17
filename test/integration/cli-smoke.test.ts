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
    // Create minimal test data
    const testAgent = `<!-- @meta
id: cli-test
alwaysApply: true
-->

## CLI Test Rule

This is a test rule for CLI testing.`;
    writeFileSync(join(d, '.agent.md'), testAgent, 'utf8');
  }
  
  return d;
}

describe('CLI smoke tests', () => {
  it('import command creates a .agent.md file', async () => {
    const dir = setupTmp();
    try {
      const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

      // First create some rule files to import
      writeFileSync(join(dir, '.rules'), '# Zed Rules\n\nTest rules for Zed', 'utf8');

      const result = await execa('node', [cliPath, 'import', dir, '-w'], {
        cwd: dir,
      });

      expect(result.exitCode).toBe(0);
      
      const content = readFileSync(join(dir, '.agent.md'), 'utf8');
      expect(content.length).toBeGreaterThan(20);
      expect(content).toContain('<!-- @meta');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('export command with dry-run does not create files', async () => {
    const dir = setupTmp();
    try {
      const cliPath = join(dirname(__dirname), '..', 'dist', 'cli.js');

      const result = await execa('node', [cliPath, 'export', '.agent.md', '--dry-run'], {
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
      
      const outputPath = copilotPath.replace(/\.md$/, '.agent.md');
      const content = readFileSync(outputPath, 'utf8');
      expect(content).toContain('<!-- @meta');
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
    expect(result.stdout).toContain('agentconfig');
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Options:');
    expect(result.stdout).toContain('Examples:');
  });
});