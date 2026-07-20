# Store metadata

Starter file generated from this template's manifest. Every store asks
for this material at submission time; keep it current as the code
changes instead of rewriting it at the end. Replace the placeholder
lines marked TODO before you submit.

Last updated: 2026-07-20

## Listing

- Name: ChatGPT (OpenAI) Sidebar
- Summary: React sidebar with ChatGPT chat.
- Description: TODO write two or three short paragraphs of user
  benefits. Describe what the user sees and gains, not how the code
  works.
- Category: TODO pick one per store (for example Productivity).
- Screenshots: TODO at least one 1280x800 screenshot per store.

## Privacy and data use

- The user's OpenAI API key is stored with the extension storage
  API on the device. It is sent only to the provider's own API and
  never to any other server.
- Prompts and page text the user submits are sent to the OpenAI
  API to generate ChatGPT responses. Nothing is transmitted until
  the user sends a message.
- The manifest declares the matching Firefox data collection
  permissions: authenticationInfo, personalCommunications,
  websiteContent. Keep that declaration, this section, and the
  privacy policy in agreement.
- Privacy policy URL: TODO required by every store once you collect
  any data.

## Chrome Web Store

### Single purpose

React sidebar with ChatGPT chat.

### Permissions justification

- sidePanel (Chromium only): Renders the extension's main interface in the browser side panel.
- storage: Persists the user's settings and preferences locally on the device.
- activeTab: Grants temporary access to the page the user is on when they invoke the extension, so it can act on that page only.
- scripting (Chromium only): Injects the extension's content script that renders its on-page interface.
- tabs: Reads the active tab's URL and title so the interface can reference the page the user is viewing.
- Host access <all_urls>: The content script runs on the pages the user visits to render the extension's on-page interface. Narrow this to the specific sites your extension needs before submitting.

## Firefox Add-ons

### Reviewer notes

TODO steps a reviewer needs to exercise the extension, plus test
credentials if sign-in is required. The build is bundled, so AMO
requires a source zip; include build-from-source instructions:
npm install, then npm run build. The dist output matches the upload.
A reviewer needs their own OpenAI API key to exercise the chat;
state that clearly here or provide a throwaway key.

### Release notes

TODO user-facing notes for the version you are submitting.

## Edge Add-ons

### Certification notes

TODO anything the certification team needs to test the extension,
including test steps and credentials. Mirrors the Firefox reviewer
notes in most cases.

## Version history

- 1.0.0 (unreleased): initial version from the ai-chatgpt template.
  Not yet submitted to any store.
