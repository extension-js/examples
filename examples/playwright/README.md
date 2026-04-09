[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Playwright Contract-First Example

> Deterministic E2E flow with Extension.js and Playwright.

This example demonstrates the recommended automation pattern:

1. run Extension.js in `--no-browser` mode
2. run `extension <dev|start> --wait --browser=<browser>` as the readiness gate
3. launch Playwright using the `distPath` from the ready contract

## Installation

```bash
npx extension@latest create <project-name> --template playwright
cd <project-name>
npm install
```

## Commands

### dev

Run normal development mode (browser launch enabled).

```bash
npm run dev
```

### dev:no-browser

Run watch mode without launching a browser.

```bash
npm run dev:no-browser
```

### dev:wait

Wait for readiness contract and exit non-zero on `error` or timeout.

```bash
npm run dev:wait
```

### dev:wait:json

Wait for readiness contract and print machine-readable JSON payload to stdout.

```bash
npm run dev:wait:json
```

### start:no-browser

Run production startup without launching a browser.

```bash
npm run start:no-browser
```

### start:wait

Wait for production readiness contract and exit non-zero on `error` or timeout.

```bash
npm run start:wait
```

### start:wait:json

Wait for production readiness contract and print machine-readable JSON payload to stdout.

```bash
npm run start:wait:json
```

### build

Build for production.

```bash
npm run build
```

### test:e2e

Run Playwright smoke test using no-browser + ready contract flow.

```bash
npm run test:e2e
```

## Canonical automation pattern

```bash
# Dev friend (watch mode)
# Terminal A
npm run dev:no-browser

# Terminal B
npm run dev:wait
npm run test:e2e
```

```bash
# Test friend (production-like)
# Terminal A
npm run start:no-browser

# Terminal B
npm run start:wait
npm run test:e2e
```

## Learn more

Learn more in the [Extension.js docs](https://extension.js.org).
