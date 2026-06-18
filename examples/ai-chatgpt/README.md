[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# AI Sidebar (ChatGPT / OpenAI) Example

> React sidebar with ChatGPT chat. Adds a side panel with a conversational interface powered by the OpenAI SDK.

![screenshot](./public/screenshot.png)

**What you'll see**: A small React UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through.

**How it works**: A content script mounts a React + TypeScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through. Styles flow through Tailwind + PostCSS. UI is composed with Radix / shadcn primitives, lucide-react, OpenAI SDK.

Conversational sidebar wired to the [OpenAI SDK](https://platform.openai.com/docs/api-reference/chat). Paste an `sk-...` key the first time you open the panel — it lives in `chrome.storage.local`, never leaves the device — and chat with ChatGPT inline next to whatever page you're on. Shares its layout and shadcn/ui primitives with the `ai-claude`, `ai-gemini`, and `ai-perplexity` siblings; only the SDK and brand accent change.

## Try it locally

```bash
npx extension@latest create my-ai-chatgpt --template ai-chatgpt
cd my-ai-chatgpt
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── scroll-area.tsx
│   ├── ApiKeyForm.tsx
│   ├── ChatInput.tsx
│   └── ChatMessage.tsx
├── content/
│   ├── ContentApp.ts
│   ├── scripts.ts
│   └── styles.css
├── images/
│   └── icon.png
├── lib/
│   ├── client.ts
│   ├── page-context.ts
│   └── utils.ts
├── sidebar/
│   ├── index.html
│   ├── scripts.tsx
│   ├── SidebarApp.tsx
│   └── styles.css
├── background.ts
└── manifest.json
```

## Commands

### dev

Run the extension in development mode. Target a browser with `--browser`:

```bash
npm run dev                 # Chromium (default)
npm run dev -- --browser=chrome
npm run dev -- --browser=edge
npm run dev -- --browser=firefox
```

### build

Build for production. Convenience scripts cover each browser:

```bash
npm run build           # Chrome (default)
npm run build:firefox
npm run build:edge
```

### preview

Preview the production build with the bundled browser:

```bash
npm run preview
```

## Tests

This template ships an end-to-end check (`template.spec.ts`) validated by the examples-repo CI on every commit.

## Learn more

- [Extension.js docs](https://extension.js.org)
- [Templates index](https://extension.js.org/docs/getting-started/templates)
- [GitHub: extension-js/extension.js](https://github.com/extension-js/extension.js)
