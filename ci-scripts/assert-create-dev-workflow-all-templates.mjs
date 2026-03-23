#!/usr/bin/env node
import {spawn} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const runnerScript = path.join(__dirname, 'assert-create-dev-workflow.mjs')

const child = spawn(process.execPath, [runnerScript], {
  stdio: 'inherit',
  env: process.env
})

child.on('close', (code) => {
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
