import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { color, colorize, formatList, header } from '../src/utils/colors.js';

describe('Color utilities', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('adds color codes when colors are supported', () => {
    process.env.TERM = 'xterm-256color';
    delete process.env.NO_COLOR;

    expect(color.success('Test')).toContain('\x1b[32m');
    expect(color.success('Test')).toContain('✓ Test');
    expect(color.error('Test')).toContain('\x1b[31m');
    expect(color.error('Test')).toContain('✗ Test');
    expect(color.warning('Test')).toContain('\x1b[33m');
    expect(color.warning('Test')).toContain('⚠ Test');
  });

  it('does not add color codes when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';

    expect(color.success('Test')).toBe('✓ Test');
    expect(color.error('Test')).toBe('✗ Test');
    expect(color.path('/path/to/file')).toBe('/path/to/file');
  });

  it('does not add color codes for dumb terminals', () => {
    process.env.TERM = 'dumb';
    delete process.env.NO_COLOR;

    expect(color.success('Test')).toBe('✓ Test');
    expect(color.bold('Bold')).toBe('Bold');
  });

  it('formats lists correctly', () => {
    const items = ['Item 1', 'Item 2', 'Item 3'];
    const result = formatList(items);
    
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
    expect(result).toContain('Item 3');
    expect(result.split('\n')).toHaveLength(3);
    // Verify it has bullets (may be styled)
    expect(result).toContain('•');
  });

  it('creates headers with proper formatting', () => {
    process.env.TERM = 'xterm';
    delete process.env.NO_COLOR;
    
    const result = header('Test Header');
    
    expect(result).toContain('Test Header');
    expect(result).toContain('─');
    expect(result.split('\n').length).toBeGreaterThan(2);
  });
});