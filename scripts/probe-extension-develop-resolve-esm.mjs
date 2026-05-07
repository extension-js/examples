// Loaded via `node --import` to register an ESM resolve hook that observes
// which `extension-develop/dist/module.*` URL the canary CLI imports. Used
// alongside the CJS probe (probe-extension-develop-resolve.cjs) so both
// `Module._load` (CJS require) and `await import()` (ESM) paths are covered.

import {register} from 'node:module'

// `import.meta.url` is already a `file://` URL string; do NOT wrap it in
// pathToFileURL (that would treat the URL as a file path and double-encode).
register('./probe-extension-develop-resolve-esm-hook.mjs', import.meta.url)
