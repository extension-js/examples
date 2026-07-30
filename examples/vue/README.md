[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# Vue Sidebar Example

> Vue.js-based extension with a sidebar panel. Adds a sidebar with a simple page.

![screenshot](./public/screenshot.png)

**What you'll see**: A Vue sidebar panel, plus a small Vue UI injected into any web page and isolated in a Shadow DOM.

**How it works**: The manifest registers a side panel (`chromium:side_panel` / `firefox:sidebar_action`) that mounts `SidebarApp.vue`. A content script mounts `ContentApp.vue` inside a Shadow DOM and applies scoped styles so the host page can't bleed through.

## Try it locally

```bash
npx extension@latest create my-vue --template vue
cd my-vue
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── ContentApp.vue
│   ├── scripts.ts
│   ├── styles.css
│   └── types.d.ts
├── images/
│   └── icon.png
├── sidebar/
│   ├── index.html
│   ├── scripts.ts
│   ├── SidebarApp.vue
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
