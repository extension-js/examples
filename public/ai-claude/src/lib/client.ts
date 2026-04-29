import Anthropic from '@anthropic-ai/sdk'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'claude_api_key'

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
  const client = new Anthropic({
    apiKey,
    // Required for browser environments — the SDK detects this and uses
    // the REST API directly instead of Node.js HTTP.
    dangerouslyAllowBrowser: true
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}
