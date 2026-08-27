[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# React Devtools Panel Example

> Adds a React devtools panel to the browser that reads the inspected page.

![screenshot](./screenshot.png)

**What you'll see**: A new **Example** tab inside the browser developer tools. The panel is a React app and it shows the title of the page you are inspecting.

**How it works**: A devtools extension is two pages, not one. The manifest points `devtools_page` at `src/devtools/index.html`, a registrar the browser loads in the background whenever devtools opens. That page has no visible UI at all, and its only job is one call to `chrome.devtools.panels.create('Example', '', 'panel/index.html')`. It stays a plain script on purpose: React there would render into a page nobody ever sees. The second page, bundled from `src/panel/`, is the React app that call registers, and it is what shows up as the Example tab.

The panel reads the inspected page through `chrome.devtools.inspectedWindow.eval` in a `useEffect` and renders one fact from it, the inspected document's title. That API works in every host, so the panel has something honest to show anywhere it loads. The component also guards on `chrome?.devtools?.inspectedWindow`, because that namespace only exists when the page runs as a real panel. Opened as an ordinary extension page it renders a short message instead of throwing.

This is not a network monitor. It reads one value and shows it, so the shape of a devtools panel stays visible under the code.

## Try it locally

```bash
npx extension@latest create my-devtools-react --template devtools-react
cd my-devtools-react
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded. Open the developer tools and pick the **Example** tab.

## Project layout

```
src/
├── devtools/
│   ├── index.html
│   └── scripts.js
├── images/
│   ├── icon.png
│   └── react.png
├── panel/
│   ├── PanelApp.tsx
│   ├── index.html
│   ├── scripts.tsx
│   └── styles.css
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
