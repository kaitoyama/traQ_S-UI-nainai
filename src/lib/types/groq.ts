export type ChatCompletion = {
  id: string
  created: number
  model: string
  choices: Array<{
    index: number
    finish_reason: string
    message?: {
      role: string
      content?: string
    }
  }>
}
