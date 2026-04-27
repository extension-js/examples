[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# TypeScript Starter Extension

> TypeScript-based extension with a sidebar panel. Adds a sidebar with a simple page.

![screenshot](./public/screenshot.png)

**What you'll see**: A small UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through.

**How it works**: A content script mounts a TypeScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through.

TypeScript starter wired through `tsconfig.json`. Extension.js generates ambient types for the Web Extension APIs and the bundler transpiles `.ts` / `.tsx` automatically.

## Try it locally

```bash
npx extension@latest create my-typescript --template typescript
cd my-typescript
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── ContentApp.ts
│   ├── scripts.ts
│   ├── styles.css
│   └── types.d.ts
├── images/
│   └── icon.png
├── sidebar/
│   ├── index.html
│   ├── scripts.ts
│   ├── SidebarApp.ts
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
