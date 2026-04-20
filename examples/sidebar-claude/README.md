[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Claude AI Sidebar Example

What you'll see: a browser sidebar (side panel) with a React chat interface powered by the Anthropic SDK, letting you talk to Claude directly from any page.

How it works: the extension registers a sidebar panel and renders a React chat UI that calls the Claude API. Your API key is stored locally in extension storage.

## Installation

```bash
npx extension@latest create <project-name> --template sidebar-claude
cd <project-name>
npm install
```

## Configuration

On first launch the sidebar asks for your Anthropic API key. Get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

The key is persisted in `chrome.storage.local` (never leaves your browser except to call the Anthropic API).

## Commands

### dev

Run the extension in development mode.

```bash
npm run dev
```

### build

Build the extension for production.

```bash
npm run build
```

### preview

Preview the extension in the browser.

```bash
npm run preview
```

## Browser targets

Chromium is the default. You can explicitly target Chrome, Edge, or Firefox:

```bash
# Chromium (default)
npm run dev

# Chrome
npm run dev -- --browser=chrome

# Edge
npm run dev -- --browser=edge

# Firefox
npm run dev -- --browser=firefox
```

## Learn more

Learn more in the [Extension.js docs](https://extension.js.org).
