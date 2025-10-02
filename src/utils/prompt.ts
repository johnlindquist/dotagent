import { select as inquirerSelect, confirm as inquirerConfirm } from '@inquirer/prompts'

export async function confirm(question: string, defaultValue = false): Promise<boolean> {
  // Check if we're in a non-interactive environment
  if (!process.stdin.isTTY || process.env.NODE_ENV === 'test') {
    return defaultValue
  }
  
  return await inquirerConfirm({
    message: question,
    default: defaultValue
  })
}

export async function select<T>(
  message: string,
  choices: Array<{ name: string; value: T }>,
  defaultIndex = 0
): Promise<T> {
  // Convert to inquirer format
  const inquirerChoices = choices.map((choice, index) => ({
    name: choice.name,
    value: choice.value,
    // Set the default based on index
    ...(index === defaultIndex ? { default: true } : {})
  }))

  return await inquirerSelect({
    message,
    choices: inquirerChoices
  })
}

// Keep prompt function for backwards compatibility if needed
export async function prompt(question: string): Promise<string> {
  // For now, we'll just throw an error if this is called
  // since it's not used in the current codebase
  throw new Error('prompt() is deprecated. Use select() or confirm() instead.')
}