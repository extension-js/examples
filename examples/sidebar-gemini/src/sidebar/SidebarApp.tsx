import {useState, useEffect, useRef} from 'react'
import {Settings, Trash2, Loader2} from 'lucide-react'
import {Button} from '../components/ui/button'
import {ScrollArea} from '../components/ui/scroll-area'
import ApiKeyForm from '../components/ApiKeyForm'
import ChatMessage from '../components/ChatMessage'
import ChatInput from '../components/ChatInput'
import {
  getApiKey,
  setApiKey,
  removeApiKey,
  sendMessage,
  type Message
} from '../lib/client'

export default function SidebarApp() {
  const [apiKey, setApiKeyState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getApiKey().then((key) => {
      setApiKeyState(key)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: 'smooth'})
  }, [messages])

  async function handleApiKeySubmit(key: string) {
    await setApiKey(key)
    setApiKeyState(key)
  }

  async function handleReset() {
    await removeApiKey()
    setApiKeyState(null)
    setMessages([])
    setError(null)
  }

  function handleClearChat() {
    setMessages([])
    setError(null)
  }

  async function handleSend(content: string) {
    if (!apiKey) return

    const userMessage: Message = {role: 'user', content}
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setError(null)
    setIsStreaming(true)

    try {
      const response = await sendMessage(apiKey, updatedMessages)
      setMessages([...updatedMessages, {role: 'assistant', content: response}])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setIsStreaming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!apiKey) {
    return <ApiKeyForm onSubmit={handleApiKeySubmit} />
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-sm font-semibold">Gemini</h1>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            aria-label="Clear chat"
            title="Clear chat"
            className="size-7"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            aria-label="Change API key"
            title="Change API key"
            className="size-7"
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ask Gemini anything. Your conversation stays in this sidebar.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/50">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                  <Loader2 className="size-4 animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
