import OpenAI from 'openai'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'perplexity_api_key'

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? null
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({[STORAGE_KEY]: key})
}

export async function removeApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

export async function sendMessage(
  apiKey: string,
  messages: Message[]
): Promise<string> {
  const client = new OpenAI({
    apiKey,
    // Perplexity exposes an OpenAI-compatible REST endpoint.
    baseURL: 'https://api.perplexity.ai',
    dangerouslyAllowBrowser: true
  })

  const response = await client.chat.completions.create({
    model: 'llama-3.1-sonar-small-128k-online',
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  })

  return response.choices[0]?.message?.content ?? ''
}
