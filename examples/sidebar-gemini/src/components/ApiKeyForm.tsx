import {useState} from 'react'
import {KeyRound} from 'lucide-react'
import {Button} from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './ui/card'

interface ApiKeyFormProps {
  onSubmit: (key: string) => void
}

export default function ApiKeyForm({onSubmit}: ApiKeyFormProps) {
  const [key, setKey] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = key.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-muted-foreground" />
            <CardTitle>Gemini API Key</CardTitle>
          </div>
          <CardDescription>
            Enter your Gemini API key to start chatting. Your key is stored
            locally in extension storage and never sent anywhere except Gemini's
            API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza..."
              autoFocus
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={!key.trim()}>
              Save & Start Chatting
            </Button>
            <p className="text-xs text-muted-foreground">
              Get your API key at{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                aistudio.google.com
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
