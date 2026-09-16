import {resolveTemplateFixture} from './harness.mjs'

function regexReplace(searchPattern, replacement) {
  return (current) => current.replace(searchPattern, replacement)
}

function appendComment(commentText) {
  return (current) =>
    `${current}\n<!-- reload-matrix: ${commentText} ${Date.now()} -->\n`
}

const ACTION_LOCALES = resolveTemplateFixture('action-locales')
const ACTION = resolveTemplateFixture('action')

export const SCENARIOS = [
  {
    name: 'locales-single-edit-popup-closed',
    fixturePath: ACTION_LOCALES,
    openPages: [],
    edits: [
      {
        relativePath: '_locales/en/messages.json',
        transform: regexReplace(
          /"message":\s*"Welcome[^"]*"/,
          '"message": "Welcome (matrix run)"'
        ),
        waitMsAfter: 200
      }
    ],
    expected: {
      serviceWorkerRestarts: 1,
      extensionPageNavigations: 0
    }
  },
  {
    name: 'locales-single-edit-popup-open',
    fixturePath: ACTION_LOCALES,
    openPages: ['action/index.html'],
    edits: [
      {
        relativePath: '_locales/en/messages.json',
        transform: regexReplace(
          /"message":\s*"Welcome[^"]*"/,
          '"message": "Welcome (matrix run popup-open)"'
        ),
        waitMsAfter: 200
      }
    ],
    expected: {
      serviceWorkerRestarts: 1,
      extensionPageNavigationsAtMost: 1
    }
  },
  {
    name: 'locales-rapid-edits-popup-closed',
    fixturePath: ACTION_LOCALES,
    openPages: [],
    edits: [
      {
        relativePath: '_locales/en/messages.json',
        transform: regexReplace(
          /"message":\s*"Welcome[^"]*"/,
          '"message": "Welcome (rapid 1)"'
        ),
        waitMsAfter: 80
      },
      {
        relativePath: '_locales/en/messages.json',
        transform: regexReplace(
          /"message":\s*"Welcome[^"]*"/,
          '"message": "Welcome (rapid 2)"'
        ),
        waitMsAfter: 80
      },
      {
        relativePath: '_locales/en/messages.json',
        transform: regexReplace(
          /"message":\s*"Welcome[^"]*"/,
          '"message": "Welcome (rapid 3)"'
        ),
        waitMsAfter: 80
      }
    ],
    // Polling watcher + aggregateTimeout collapse the burst; we expect
    // 1 or 2 SW restarts, never 3.
    expected: {
      serviceWorkerRestartsAtMost: 2,
      extensionPageNavigations: 0
    }
  },

  {
    name: 'manifest-edit-popup-closed',
    fixturePath: ACTION_LOCALES,
    openPages: [],
    edits: [
      {
        relativePath: 'src/manifest.json',
        transform: regexReplace(
          /"description":\s*"[^"]*"/,
          '"description": "Matrix-run description bump"'
        ),
        waitMsAfter: 200
      }
    ],
    expected: {
      serviceWorkerRestarts: 1,
      extensionPageNavigations: 0
    }
  },
  {
    name: 'popup-html-edit-popup-open',
    fixturePath: ACTION,
    openPages: ['action/index.html'],
    edits: [
      {
        relativePath: 'src/action/index.html',
        transform: appendComment('popup-html-edit'),
        waitMsAfter: 200
      }
    ],
    expected: {
      serviceWorkerRestartsAtMost: 0,
      extensionPageNavigationsAtMost: 1
    }
  },
  {
    name: 'popup-html-edit-popup-closed',
    fixturePath: ACTION,
    openPages: [],
    edits: [
      {
        relativePath: 'src/action/index.html',
        transform: appendComment('popup-html-edit-no-popup'),
        waitMsAfter: 200
      }
    ],
    // No popup open = nothing to refresh. The SW must NOT restart; the
    // updated bundle is on disk for the next time the user opens the popup.
    expected: {
      serviceWorkerRestartsAtMost: 0,
      extensionPageNavigationsAtMost: 0
    }
  }
]
