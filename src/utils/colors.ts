// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
}

// Check if colors are supported
function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false
  if (process.env.TERM === 'dumb') return false
  if (process.env.COLORTERM) return true
  if (process.env.TERM?.includes('color')) return true
  // Default to false for safety in tests
  return false
}

export function colorize(text: string, color: keyof typeof colors): string {
  if (!supportsColor()) return text
  return `${colors[color]}${text}${colors.reset}`
}

export const color = {
  // Status messages
  success: (text: string) => colorize(`✓ ${text}`, 'green'),
  error: (text: string) => colorize(`✗ ${text}`, 'red'),
  warning: (text: string) => colorize(`⚠ ${text}`, 'yellow'),
  info: (text: string) => colorize(`ℹ ${text}`, 'blue'),
  
  // Text formatting
  bold: (text: string) => colorize(text, 'bright'),
  dim: (text: string) => colorize(text, 'dim'),
  
  // Semantic colors
  path: (text: string) => colorize(text, 'cyan'),
  command: (text: string) => colorize(text, 'magenta'),
  number: (text: string) => colorize(text, 'yellow'),
  format: (text: string) => colorize(text, 'blue'),
  
  // Raw colors
  red: (text: string) => colorize(text, 'red'),
  green: (text: string) => colorize(text, 'green'),
  yellow: (text: string) => colorize(text, 'yellow'),
  blue: (text: string) => colorize(text, 'blue'),
  gray: (text: string) => colorize(text, 'gray'),
}

// Helper for creating formatted lists
export function formatList(items: string[], prefix = '  '): string {
  return items.map(item => `${prefix}${color.dim('•')} ${item}`).join('\n')
}

// Helper for creating a header
export function header(text: string): string {
  const line = color.dim('─'.repeat(text.length + 4))
  return `\n${line}\n${color.bold(`  ${text}  `)}\n${line}\n`
}