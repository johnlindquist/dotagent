import { createInterface } from 'readline'
import { stdin as input, stdout as output } from 'process'

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output })
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function confirm(question: string, defaultValue = false): Promise<boolean> {
  const defaultHint = defaultValue ? 'Y/n' : 'y/N'
  const answer = await prompt(`${question} (${defaultHint}): `)
  
  if (answer === '') {
    return defaultValue
  }
  
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

export async function select<T>(
  message: string,
  choices: Array<{ name: string; value: T }>,
  defaultIndex = 0
): Promise<T> {
  console.log(message)
  choices.forEach((choice, index) => {
    const marker = index === defaultIndex ? '>' : ' '
    console.log(`${marker} [${index + 1}] ${choice.name}`)
  })
  console.log()
  
  const answer = await prompt(`Select an option (1-${choices.length}) [${defaultIndex + 1}]: `)
  
  if (answer === '') {
    return choices[defaultIndex].value
  }
  
  const index = parseInt(answer, 10) - 1
  if (isNaN(index) || index < 0 || index >= choices.length) {
    console.log('Invalid selection. Using default.')
    return choices[defaultIndex].value
  }
  
  return choices[index].value
}