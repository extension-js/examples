import {GoogleGenerativeAI} from '@google/generative-ai'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'gemini_api_key'

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
  const client = new GoogleGenerativeAI(apiKey)

  const model = client.getGenerativeModel({model: 'gemini-2.0-flash'})

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{text: m.content}]
  }))
  const last = messages[messages.length - 1]

  const chat = model.startChat({history})
  const result = await chat.sendMessage(last.content)
  return result.response.text()
}
