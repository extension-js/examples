[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Svelte Content

What you’ll see: a small Svelte UI injected into any page, rendered inside a Shadow DOM so site styles don’t interfere.

How it works here: a content script mounts a Svelte component and styles it in isolation, demonstrating DOM injection in an extension.

## Installation

```bash
npx extension@latest create <project-name> --template content-svelte
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
