#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const README = path.join(ROOT, 'README.md')
const EXAMPLES = path.join(ROOT, 'examples')

const ROW = /blob\/main\/examples\/([a-z0-9-]+)\/README\.md[\s\S]*?<tr><td>Version<\/td><td align="right">([^<]*)<\/td>/g

function declaredVersion(example) {
  const file = path.join(EXAMPLES, example, 'package.json')
  if (!fs.existsSync(file)) return null
  try {
    return String(JSON.parse(fs.readFileSync(file, 'utf8')).version || '').trim()
  } catch {
    return null
  }
}

function main() {
  const readme = fs.readFileSync(README, 'utf8')
  const rows = [...readme.matchAll(ROW)].map(([, example, version]) => ({
    example,
    version: version.trim()
  }))

  if (rows.length === 0) {
    console.error(
      'assert-catalog-readme: the catalog table has no Version rows to check. ' +
        'Either the table shape changed or the regex stopped matching; a guard that matches nothing is not a guard.'
    )
    process.exitCode = 1
    return
  }

  const problems = []

  for (const row of rows) {
    const declared = declaredVersion(row.example)
    if (declared === null) {
      problems.push(
        `${row.example}: the catalog lists it but examples/${row.example}/package.json is missing or unreadable`
      )
      continue
    }
    if (declared !== row.version) {
      problems.push(
        `${row.example}: catalog says ${row.version || '(empty)'}, examples/${row.example}/package.json says ${declared}`
      )
    }
  }

  if (problems.length) {
    console.error(
      `assert-catalog-readme: ${problems.length} of ${rows.length} catalog Version rows disagree with the example they describe.\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\nThe catalog is the first thing a stranger reads. Update README.md to the versions the examples declare.'
    )
    process.exitCode = 1
    return
  }

  console.log(
    `assert-catalog-readme: ${rows.length} catalog Version rows all match the example package.json they describe.`
  )
}

main()
