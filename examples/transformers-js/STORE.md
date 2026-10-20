# Store metadata

Starter file generated from this template's manifest. Every store asks
for this material at submission time; keep it current as the code
changes instead of rewriting it at the end. Replace the placeholder
lines marked TODO before you submit. The Privacy and data use section
is listing copy; the privacy policy itself is PRIVACY.md beside this
file, which extension.dev publishes at the project's privacy address
while the file exists. Add a Privacy policy URL row under Listing only
when you host the policy elsewhere.

Last updated: 2026-10-19

## Listing

- Name: Transformers.js Example
- Summary: Classifies pages and selections with on-device AI.
- Description: TODO write two or three short paragraphs of user
  benefits. Describe what the user sees and gains, not how the code
  works.
- Category: TODO pick one per store (for example Productivity).
- Screenshots: TODO at least one 1280x800 screenshot per store.

## Privacy and data use
- Collected: nothing. The extension sends no user data to any server, has
  no account or sign-in, and runs no analytics.
- sidePanel (Chromium only): opens the extension's interface in the
  browser side panel; it reads no page data by itself.
- storage: keeps the extension's own settings, and anything the user types
  into its options, in the browser's extension storage on the user's
  device.
- tabs: reads the title and address of the open tab so the interface can
  say which page it refers to.
- contextMenus: adds the extension's entry to the right-click menu and
  hands it the text the user selected only when the user picks that entry.
- Host access <all_urls>: lets the extension's content script run on the
  pages the user visits so its interface can appear there.
- Not collected: browsing history, page content, activity on websites,
  sign-in or account data, messages the user writes, location, search
  terms, bookmarks, payment details, health information, personal files,
  and usage analytics. Nothing leaves the browser.
- Firefox data collection declaration: the manifest declares
  data_collection_permissions required: none, which matches the lines
  above. If you add data collection, update the declaration, this section,
  and your privacy policy in the same change.

## Chrome Web Store

### Single purpose

Classifies pages and selections with on-device AI.

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
