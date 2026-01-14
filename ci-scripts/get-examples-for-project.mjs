#!/usr/bin/env node

/**
 * Maps Playwright project names to example directory patterns
 * Returns a comma-separated list of example names that match the project's testMatch pattern
 */

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)

const examplesDir = path.join(repoRoot, 'examples')

// Map Playwright project names to example name patterns
const PROJECT_TO_EXAMPLES = {
  content: /^(content|content-.*)$/,
  sidebar: /^(sidebar|sidebar-.*)$/,
  action: /^(action|action-.*)$/,
  newtab: /^(new|new-.*)$/,
  'special-folders': /^special-folders-.*$/,
  'mixed-context': /^(javascript|preact|react|svelte|typescript|vue)$/,
  other: /^(init)$/
}

function getExamplesForProject(projectName) {
  const pattern = PROJECT_TO_EXAMPLES[projectName]
  if (!pattern) {
    console.error(`►►► Unknown project: ${projectName}`)
    console.error(
      `►►► Available projects: ${Object.keys(PROJECT_TO_EXAMPLES).join(', ')}`
    )
    process.exit(1)
  }

  const allExamples = fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)

  const matchingExamples = allExamples.filter((example) =>
    pattern.test(example)
  )

  return matchingExamples
}

// If called from command line (check if process.argv[1] matches this file)
import {fileURLToPath} from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] === __filename

if (isMainModule) {
  const projectName = process.argv[2]
  if (!projectName) {
    console.error('►►► Usage: node get-examples-for-project.mjs <project-name>')
    console.error(
      `►►► Available projects: ${Object.keys(PROJECT_TO_EXAMPLES).join(', ')}`
    )
    process.exit(1)
  }

  const examples = getExamplesForProject(projectName)
  // Output as comma-separated list for use in shell scripts
  console.log(`►►► ${examples.join(',')}`)
}

// Export for use as a module
export {getExamplesForProject, PROJECT_TO_EXAMPLES}
