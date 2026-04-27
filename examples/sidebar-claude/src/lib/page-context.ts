import type {PageContext} from '../content/scripts'

export type {PageContext}

interface ContextResponse {
  ok: boolean
  context?: PageContext
  error?: string
}

export async function getActiveTabContext(): Promise<PageContext | null> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'getActiveTabContext'
    })) as ContextResponse | undefined
    if (!response?.ok || !response.context) return null
    return response.context
  } catch {
    return null
  }
}

export function buildSystemPrompt(
  context: PageContext,
  productName: string
): string {
  return [
    `You are ${productName}, embedded as a browser sidebar assistant.`,
    `The user is currently viewing this page:`,
    `Title: ${context.title || '(no title)'}`,
    `URL: ${context.url}`,
    ``,
    `Page content (truncated):`,
    context.text || '(no extractable text)',
    ``,
    `Use this page context when relevant. If the user asks about "this page", refer to the content above.`
  ].join('\n')
}
