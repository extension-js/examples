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
    writeSync(2, `__EXT_DEV_RESOLVED__::${result.url}\n`)
  }

  return result
}
