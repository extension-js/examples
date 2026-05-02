// Direct fetch against Anthropic's REST API. The official @anthropic-ai/sdk
// is designed for Node.js and ships ~150 KB of retry/transport/streaming
// machinery a content-script context doesn't need; this thin wrapper hits
// the same endpoint and keeps the bundle small.

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'claude_api_key'
const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 1024

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

interface AnthropicResponse {
  content?: Array<{type: string; text?: string}>
  error?: {type: string; message: string}
}

export async function sendMessage(
  apiKey: string,
  messages: Message[],
  systemPrompt?: string
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      // Required for browser-origin requests; opts in to direct access.
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      }))
    })
  })

  const data = (await response.json()) as AnthropicResponse

  if (!response.ok) {
    const detail = data?.error?.message || response.statusText
    throw new Error(`Anthropic API ${response.status}: ${detail}`)
  }

  const textBlock = data.content?.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}
