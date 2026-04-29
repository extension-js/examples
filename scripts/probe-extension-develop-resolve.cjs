'use strict'

// Loaded via `node --require` to observe which `extension-develop/dist/module.*`
// the canary CLI actually loads. Prints a single marker line to stderr and
// exits cleanly so we don't drag the dev server into a real run.

const Module = require('module')

// Matches both shapes the resolver can target: the installed runtime under
// `node_modules/extension-develop/dist/module.*` and the workspace runtime
// under `programs/develop/dist/module.*`. The assertion downstream verifies
// which of the two actually got loaded.
const PATTERN =
  /(?:[\\/]extension-develop[\\/]|[\\/]programs[\\/]develop[\\/])dist[\\/]module\.[cm]?js$/
const origLoad = Module._load

let observed = false
Module._load = function patchedLoad(request, parent, isMain) {
  const result = origLoad.call(this, request, parent, isMain)

  if (!observed && typeof request === 'string' && PATTERN.test(request)) {
    observed = true
    const line = `__EXT_DEV_RESOLVED__::${request}\n`
    if (process.stderr.write(line)) process.exit(0)
    else process.stderr.once('drain', () => process.exit(0))
  }

  return result
}
