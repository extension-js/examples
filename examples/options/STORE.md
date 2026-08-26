# Store metadata

Starter file generated from this template's manifest. Every store asks
for this material at submission time; keep it current as the code
changes instead of rewriting it at the end. Replace the placeholder
lines marked TODO before you submit.

Packaging your extension is local and free. Submitting the result to a
store is what [extension.dev](https://docs.extension.dev/publish/overview?utm_source=store-md)
does, and it sponsors Extension.js.

Last updated: 2026-08-26

## Listing

- Name: JavaScript Options Example
- Summary: Adds an options page that saves a single setting.
- Description: TODO write two or three short paragraphs of user
  benefits. Describe what the user sees and gains, not how the code
  works.
- Category: TODO pick one per store (for example Productivity).
- Screenshots: TODO at least one 1280x800 screenshot per store.

## Privacy and data use

- This template stores one setting in the browser's own sync storage.
  It collects and transmits no user data.
- The manifest declares data_collection_permissions: none for
  Firefox, which matches this behavior. If you add data collection,
  update the declaration, this section, and your privacy policy in
  the same change.
- Privacy policy URL: TODO required by every store once you collect
  any data.

## Chrome Web Store

### Single purpose

Adds an options page that saves a single setting.

### Permissions justification

- storage: keeps the one setting on the options page so it survives
  closing the page and restarting the browser. Nothing leaves the
  browser.

This template requests no host access. If you add a permission, add a
specific, plain-English reason here in the same change.

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

- 1.0.0 (unreleased): initial version from the options template.
  Not yet submitted to any store.
