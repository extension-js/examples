[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# AI Sidebar (Perplexity) Example

> Adds a sidebar panel where you can chat with Perplexity about the page you are viewing.

![screenshot](./screenshot.png)

**What you'll see**: A small React UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through.

**How it works**: The manifest registers a side panel (`chromium:side_panel` / `firefox:sidebar_action`) that loads a React + TypeScript page bundled from `src/sidebar/`. A content script mounts a React + TypeScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through. On Chromium the in-page pill opens the panel. Firefox only opens a sidebar from a toolbar gesture, so the gecko build renders the pill inert with a hint to use the toolbar icon instead. Styles flow through Tailwind + PostCSS. UI is composed with Radix / shadcn primitives, lucide-react, OpenAI SDK.

Conversational sidebar wired to the [Perplexity API](https://docs.perplexity.ai/) : online-search-grounded models served through an OpenAI-compatible endpoint, so the same `openai` SDK is reused with a different `baseURL`. Paste a `pplx-...` key the first time you open the panel (it lives in `chrome.storage.local` and never leaves the device) and ask Perplexity questions that get answered with live citations. Shares its layout and shadcn/ui primitives with the `ai-claude`, `ai-chatgpt`, and `ai-gemini` siblings.

## Try it locally

```bash
npx extension@latest create my-ai-perplexity --template ai-perplexity
cd my-ai-perplexity
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
│   ├── icon-128.png
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-64.png
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

Cloned this repo instead? The examples ship without npm scripts, so run Extension.js directly from the example directory. Run `npm install` first when the example declares dependencies.

### dev

Run the extension in development mode. Target a browser with `--browser`:

```bash
npx extension@latest dev .                  # Chromium (default)
npx extension@latest dev . --browser=chrome
npx extension@latest dev . --browser=edge
npx extension@latest dev . --browser=firefox
```

### build

Build for production:

```bash
npx extension@latest build .                # Chromium (default)
npx extension@latest build . --browser=firefox
npx extension@latest build . --browser=edge
```

### preview

Preview the production build with the bundled browser:

```bash
npx extension@latest preview .
```

## Tests

This template ships an end-to-end check (`template.spec.ts`) validated by the examples-repo CI on every commit.

## Learn more

- [Extension.js docs](https://extension.js.org)
- [Templates index](https://extension.js.org/docs/getting-started/templates)
- [GitHub: extension-js/extension.js](https://github.com/extension-js/extension.js)
