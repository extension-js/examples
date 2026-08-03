[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# React Sidebar (shadcn/ui) Example

> Adds a sidebar panel to the browser built with shadcn/ui components.

![screenshot](./screenshot.png)

**What you'll see**: A browser side panel that loads when you open the sidebar.

**How it works**: The manifest registers a side panel (`chromium:side_panel` / `firefox:sidebar_action`) that loads a React + TypeScript page bundled from `src/sidebar/`. Styles flow through Tailwind + PostCSS. UI is composed with Radix / shadcn primitives, lucide-react.

A React sidebar built with [shadcn/ui](https://ui.shadcn.com/) primitives over Radix UI and Tailwind v4. Cards, switches, and labels are composed from the registry, not pulled from a UI library; the components live inside the project under `src/components/ui/`.

## Try it locally

```bash
npx extension@latest create my-sidebar-shadcn --template sidebar-shadcn
cd my-sidebar-shadcn
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── label.tsx
│       └── switch.tsx
├── images/
│   └── icon.png
├── lib/
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
