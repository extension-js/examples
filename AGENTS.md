# AGENTS.md

Entry point for AI coding agents working on Extension.js examples.

## What this repo is

A collection of browser extension examples built with [Extension.js](https://github.com/extension-js/extension.js), a cross-browser extension framework. Each subdirectory under `examples/` is an independent example project pinned in the pnpm workspace.

## Entrypoint contracts

Extension.js auto-discovers entrypoints from `manifest.json` and bundles them with conventions that differ from a vanilla Chrome extension. Read this section before editing any entrypoint file — the conventions are not obvious from the code alone.

### `content_scripts`

A content_script file is a **module**, not a script that runs top-to-bottom on injection. The framework imports the module and invokes its default export.

- The default export is a setup function. Extension.js calls it once when the content script is injected.
- The setup function may return a cleanup function. Extension.js calls it on HMR teardown and on extension reload to remove DOM/state from the page before re-running setup.
- **Do not add an initializer call** like `initial()` at the bottom of the file. The framework calls the default export for you. Adding a manual call will run setup twice.
- Side-effectful top-level code (e.g. `chrome.runtime.onMessage.addListener(...)`) runs at module-load time and is fine for listener-only content scripts that don't touch the DOM. Such files may have no default export at all (see `examples/transformers-js/src/content/scripts.js`).

Canonical shape:

```js
export default function initial() {
  // setup: inject DOM, mount UI, register page listeners
  const root = document.createElement('div')
  document.body.appendChild(root)

  return () => {
    // cleanup: undo everything setup did
    root.remove()
  }
}
```

Every content_script entrypoint in this repo carries a JSDoc above its default export restating this contract. Preserve it when editing.

### Other entrypoints

- `background.js` / service worker: standard MV3 service worker. Top-level code runs on each wake.
- `popup`, `options`, `sidebar`, `newtab`, `devtools`, `pages/*`: HTML entrypoints. The HTML's `<script>` tag points to a JS/TS module loaded as the page's main script — no default-export contract.
- `manifest.json` references **source paths** (e.g. `content/scripts.js`), not built paths. Extension.js rewrites them at build time.

## Layout

```
examples/
├── examples/<name>/        # one example per directory
│   ├── src/
│   │   ├── manifest.json   # entrypoint declarations (source paths)
│   │   ├── background.js   # optional
│   │   └── content/        # content scripts (default-export contract)
│   ├── extension.config.js # optional Extension.js config
│   └── package.json
├── public/                 # shared screenshots/assets for the README
├── scripts/                # repo-wide tooling
└── playwright.config.ts    # E2E tests run per example
```

## Common commands

Run from inside an example directory:

```sh
pnpm dev          # start Extension.js dev server (HMR + auto-reload)
pnpm build        # production build → dist/<browser>
pnpm start        # build + open browser with the loaded extension
```

Run from the repo root:

```sh
pnpm install      # install all workspace deps
pnpm -r build     # build every example
pnpm test         # run E2E (Playwright) across examples
```

## Artifact pipeline (templates-meta.json and public/)

The committed `templates-meta.json` and the `public/<slug>/` mirrors are
post-stage artifacts. CI produces them in four steps: `build:examples`, then
`artifacts:package`, then `generate:raw`, then `artifacts:stage`. The stage
step rewrites the raw generator output (commit becomes `main`, file paths gain
the `public/<slug>/` prefix, `repositoryUrl` is added) and refreshes the
mirrors.

- To regenerate the committed artifacts locally, run `pnpm artifacts:prepare`.
  Never run `pnpm generate` alone for this: the raw generator writes the
  pre-stage shape, and committing that regresses the paths that
  templates.extension.dev and other consumers read.
- `pnpm generate` refuses to overwrite a staged `templates-meta.json` and
  points at the commands above. `pnpm generate:raw` bypasses the guard and is
  meant for the pipeline only.
- Never hand-edit anything under `public/<slug>/`. Those are generated
  mirrors, edit `examples/<slug>/` and re-stage instead.

## Editing guidance for agents

- When asked to add behavior to a content script, modify the body of the default-exported function. Don't introduce a new top-level call.
- When asked to "make this run on page load" — it already does. The framework injects per `content_scripts.matches` in the manifest.
- When asked to "clean up", extend the returned cleanup function. Don't add `window.addEventListener('unload', ...)` unless you also need it for tab-navigation cases the framework's teardown doesn't cover.
- Do not import from `dist/`. The framework rewrites source paths; reference source files only.
- Do not add a bundler config (webpack/vite/rspack) — Extension.js owns bundling. Per-example overrides go in `extension.config.js`.
