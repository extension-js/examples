// ESM resolve hook (runs in Node's loader worker thread). Mirrors the CJS
// probe-extension-develop-resolve.cjs: observes the first resolution that
// matches the installed-runtime or workspace-runtime entry, prints a marker
// line on stderr, and exits the *worker* thread cleanly. The main thread
// then sees the marker land in stderr and the resolver returns normally.

import {writeSync} from 'node:fs'

const PATTERN =
  /(?:[\\/]extension-develop[\\/]|[\\/]programs[\\/]develop[\\/])dist[\\/]module\.[cm]?js$/

let observed = false

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context)

  if (
    !observed &&
    typeof result?.url === 'string' &&
    PATTERN.test(result.url)
  ) {
    observed = true
    // writeSync to fd 2 because process.stderr in the loader thread is not
    // always wired the same way as on the main thread.
    writeSync(2, `__EXT_DEV_RESOLVED__::${result.url}\n`)
    // Signal main thread by triggering an unrecoverable error path is too
    // aggressive; instead we let the load proceed and rely on stderr capture.
    // The assert script's downstream dev() failure (no real package.json) is
    // expected and harmless once the marker has been observed.
  }

  return result
}
