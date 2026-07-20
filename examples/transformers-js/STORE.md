# Store metadata

Starter file generated from this template's manifest. Every store asks
for this material at submission time; keep it current as the code
changes instead of rewriting it at the end. Replace the placeholder
lines marked TODO before you submit.

Last updated: 2026-07-20

## Listing

- Name: Transformers.js Example
- Summary: Transformers.
- Description: TODO write two or three short paragraphs of user
  benefits. Describe what the user sees and gains, not how the code
  works.
- Category: TODO pick one per store (for example Productivity).
- Screenshots: TODO at least one 1280x800 screenshot per store.

## Privacy and data use

- All inference runs on the device through WebGPU or WASM. Page text
  and selections never leave the browser.
- Model and tokenizer files are downloaded from the Hugging Face Hub
  on first run and cached locally.
- The manifest declares data_collection_permissions: none for
  Firefox, which matches this behavior.
- Privacy policy URL: TODO required by every store once you collect
  any data.

## Chrome Web Store

### Single purpose

Transformers.

### Permissions justification

- sidePanel (Chromium only): Renders the extension's main interface in the browser side panel.
- storage: Persists the user's settings and preferences locally on the device.
- unlimitedStorage: Caches downloaded machine-learning model files locally so they are not re-downloaded on every run.
- activeTab: Grants temporary access to the page the user is on when they invoke the extension, so it can act on that page only.
- scripting (Chromium only): Injects the extension's content script that renders its on-page interface.
- tabs: Reads the active tab's URL and title so the interface can reference the page the user is viewing.
- contextMenus: Adds a right-click menu item that runs the extension on the current text selection.
- Host access <all_urls>: The content script runs on the pages the user visits to render the extension's on-page interface. Narrow this to the specific sites your extension needs before submitting.

## Firefox Add-ons

### Reviewer notes

TODO steps a reviewer needs to exercise the extension, plus test
credentials if sign-in is required. The build is bundled, so AMO
requires a source zip; include build-from-source instructions:
npm install, then npm run build. The dist output matches the upload.

### Release notes

TODO user-facing notes for the version you are submitting.

## Edge Add-ons

### Certification notes

TODO anything the certification team needs to test the extension,
including test steps and credentials. Mirrors the Firefox reviewer
notes in most cases.

## Version history

- 1.0.0 (unreleased): initial version from the transformers-js template.
  Not yet submitted to any store.
