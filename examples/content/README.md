[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Content

What you’ll see: a small badge injected into any web page, rendered inside a Shadow DOM so page styles don’t interfere.

How it works here: a content script mounts a simple UI and styles it, demonstrating DOM injection and styling in the extension context.

## Installation

```bash
npx extension@latest create <project-name> --template content
cd <project-name>
npm install
```

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

## Learn more

Learn more about creating cross-browser extensions at https://extension.js.org
