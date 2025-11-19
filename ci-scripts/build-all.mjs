#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const examplesDir = path.join(repoRoot, 'examples')

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {cwd, stdio: 'inherit', env: process.env, shell: false})
  if (r.error) throw r.error
  return r.status === 0
}

function listExamples() {
  return fs.readdirSync(examplesDir, {withFileTypes: true})
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

const browsers = ['chrome', 'edge', 'firefox']
const slugs = listExamples()
if (slugs.length === 0) {
  console.log('No examples found to build.')
  process.exit(0)
}

/** @type {Array<{slug:string,browser:string,ok:boolean}>} */
const results = []
for (const slug of slugs) {
  const dir = path.join(examplesDir, slug)
  for (const browser of browsers) {
    console.log(`\n=== Building ${slug} [${browser}] ===`)
    const ok = run('node', [path.join(repoRoot, 'ci-scripts', 'build-with-manifest.mjs'), 'build', `--browser=${browser}`, '--outDir=dist'], dir)
    results.push({slug, browser, ok})
  }
}

console.log('\nBuild summary:')
let failures = 0
for (const r of results) {
  const mark = r.ok ? '✅' : '❌'
  if (!r.ok) failures++
  console.log(`${mark} ${r.slug} [${r.browser}]`)
}

if (failures > 0) process.exit(1)


