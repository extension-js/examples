import {Bot, User} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type {Message} from '../lib/client'
import {cn} from '../lib/utils'

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({message}: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'bg-transparent' : 'bg-muted/50'
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
