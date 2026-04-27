import OpenAI from 'openai'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'openai_api_key'

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
  messages: Message[],
  systemPrompt?: string
): Promise<string> {
  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  })

  const payload: {role: 'system' | 'user' | 'assistant'; content: string}[] = []
  if (systemPrompt) {
    payload.push({role: 'system', content: systemPrompt})
  }
  for (const m of messages) {
    payload.push({role: m.role, content: m.content})
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: payload
  })

  return response.choices[0]?.message?.content ?? ''
}
