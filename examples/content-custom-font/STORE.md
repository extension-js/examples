# Store metadata

Starter file generated from this template's manifest. Every store asks
for this material at submission time; keep it current as the code
changes instead of rewriting it at the end. Replace the placeholder
lines marked TODO before you submit.

Packaging your extension is local and free. Submitting the result to a
store is what [extension.dev](https://docs.extension.dev/publish/overview?utm_source=store-md)
does, and it sponsors Extension.js.

Last updated: 2026-08-27

## Listing

- Name: Custom Fonts Content Example
- Summary: Injects a badge with a custom font into web pages, with an options page that turns that font on and off.
- Description: TODO write two or three short paragraphs of user
  benefits. Describe what the user sees and gains, not how the code
  works.
- Category: TODO pick one per store (for example Productivity).
- Screenshots: TODO at least one 1280x800 screenshot per store.

## Privacy and data use

- This template stores one setting, whether the badge uses the custom
  font, in the browser's own sync storage, read by both the options page
  and the content script. It collects and transmits no user data.
- The manifest declares data_collection_permissions: none for
  Firefox, which matches this behavior. If you add data collection,
  update the declaration, this section, and your privacy policy in
  the same change.
- Privacy policy URL: TODO required by every store once you collect
  any data.

## Chrome Web Store

### Single purpose

Injects a badge with a custom font into web pages, with an options page that turns that font on and off.

### Permissions justification

- activeTab: Grants temporary access to the page the user is on when they invoke the extension, so it can act on that page only.
- scripting: Injects the extension's content script that renders its on-page interface.
- storage: keeps the one setting so it survives closing the page and
  restarting the browser, and so the content script can read the same
  value the options page wrote. Nothing leaves the browser.
- Host access <all_urls>: The content script runs on the pages the user visits to render the extension's on-page interface. Narrow this to the specific sites your extension needs before submitting.

## Firefox Add-ons

### Reviewer notes

This extension bundles the Momo Signature typeface under public/fonts/.
It is licensed under the SIL Open Font License 1.1 and the licence text
ships beside the binaries as public/fonts/OFL.txt, which the licence
requires. Keep that file in the package you upload.

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

- 1.0.0 (unreleased): initial version from the content-custom-font template.
  Not yet submitted to any store.
