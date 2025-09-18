import type { ChatCompletion } from './types/groq'

/**
 * Runtime configuration for Groq API access.
 */
const API_URL =
  import.meta.env.VITE_GROQ_CHAT_COMPLETION_URL ??
  'https://api.groq.com/openai/v1/chat/completions'
const API_KEY = import.meta.env.VITE_GROQ_API_KEY
const MODEL = import.meta.env.VITE_GROQ_MESSAGE_MODEL ?? 'llama3-8b-8192'
const TEMPERATURE = Number(import.meta.env.VITE_GROQ_MESSAGE_TEMPERATURE ?? 0)
const MAX_CONTENT_LENGTH = Number(
  import.meta.env.VITE_GROQ_MESSAGE_MAX_LENGTH ?? 4000
)

const clampContent = (raw: string) => {
  const normalized = raw.trim()
  if (Number.isFinite(MAX_CONTENT_LENGTH) && MAX_CONTENT_LENGTH > 0) {
    if (normalized.length > MAX_CONTENT_LENGTH) {
      return normalized.slice(0, MAX_CONTENT_LENGTH)
    }
  }
  return normalized
}

export type GroqMessageClassification = {
  sanityScore: number
  isWorkRelated: boolean
}

const systemPrompt = `あなたはチャットメッセージを評価するJSON分類器です。
出力は必ずJSON一つだけで、プロパティは次の通りです:
  - sanityScore: メッセージのまとも度を0から1の範囲で示す数値。0はふざけた内容、1は非常に真面目・業務的。
  - isWorkRelated: メッセージが業務連絡・仕事の話題である場合true、それ以外false。
メッセージに含まれる引用やスタンプなどのメタ情報は無視し、本文の意味を重視してください。
メッセージが空、単なるスタンプ、または意味が取れない場合はsanityScoreを0にしてください。
` as const

const buildUserContent = (content: string) =>
  `対象メッセージ:
${JSON.stringify(clampContent(content))}
上記のメッセージを評価し、指定したJSON形式のみを返してください。`

const ensureApiConfigured = () => {
  if (!API_KEY) {
    if (!import.meta.env.PROD) {
      // eslint-disable-next-line no-console
      console.warn('Groq API key is not configured. Skipping message classification.')
    }
    return false
  }
  return true
}

export const classifyMessageContent = async (
  content: string
): Promise<GroqMessageClassification | undefined> => {
  if (!ensureApiConfigured()) return undefined
  if (!content) {
    return { sanityScore: 0, isWorkRelated: false }
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: 128,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserContent(content) }
        ]
      })
    })

    if (!response.ok) {
      if (!import.meta.env.PROD) {
        // eslint-disable-next-line no-console
        console.error('Groq classification request failed', response.statusText)
      }
      return undefined
    }

    const data = (await response.json()) as ChatCompletion
    const text = data.choices?.[0]?.message?.content
    if (!text) return undefined

    const parsed = JSON.parse(text) as Partial<GroqMessageClassification>
    const sanityScore = typeof parsed.sanityScore === 'number' ? parsed.sanityScore : NaN
    const isWorkRelated = Boolean(parsed.isWorkRelated)

    if (!Number.isFinite(sanityScore)) return undefined

    return {
      sanityScore: Math.min(Math.max(sanityScore, 0), 1),
      isWorkRelated
    }
  } catch (error) {
    if (!import.meta.env.PROD) {
      // eslint-disable-next-line no-console
      console.error('Groq classification failure', error)
    }
    return undefined
  }
}
