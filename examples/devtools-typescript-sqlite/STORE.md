# Store metadata

Last updated: 2026-10-08

## Listing

- Name: SQLite Request DevTools Panel Example
- Summary: Records the inspected page's network requests in SQLite and lets you query them.
- Description: Open the Requests tab in the developer tools and every
  request the page makes is written into a SQLite database that stays in
  the extension. Type a SQL query, run it, and read the rows in the table.
  The database engine is part of the extension. Nothing is downloaded when
  the panel opens, and nothing you inspect is uploaded.
- Category: Developer Tools
- Screenshots: examples/devtools-typescript-sqlite/screenshot.png (2400x1800)

## Privacy and data use

- Request method, URL, status, MIME type, and timing for the page you are
  inspecting are written into a SQLite database that lives in the devtools
  panel. The database stays in that panel until you close the developer
  tools. It is not saved to disk and it is not uploaded.
- The extension collects nothing for the developer and transmits nothing
  off the device. There is no account, no analytics, and no remote API.
- The manifest declares data_collection_permissions: none for Firefox,
  which matches this behavior. If you add data collection, update the
  declaration, this section, and your privacy policy in the same change.
- Privacy policy URL: TODO required by a store if a later version starts
  sending request logs or any other user data off the device.

## Chrome Web Store

### Single purpose

Shows the inspected page's network requests in a devtools panel and lets you query them with SQL.

### Permissions justification

This extension requests no permissions and no host access. The panel
reads requests through chrome.devtools.network, which the devtools
context grants without a permission entry. The SQLite engine runs from
a WebAssembly file shipped inside the extension.

## Firefox Add-ons

### Reviewer notes

Open the developer tools on any https page, then choose the Requests
tab. The heading is "Request SQL" and the status line names the SQLite
version and how many requests were recorded. The query box already
holds a SELECT. Choose Run query and the table lists method, status,
and URL. Edit the query, for example to filter on status, and run it
again. No account is required. The build is bundled, so AMO requires a
source zip; include build-from-source instructions: npm install, then
npm run build. The dist output matches the upload. The SQLite engine is
the sql.js package compiled to WebAssembly and shipped inside the
extension. It is not downloaded when the panel opens.

### Release notes

Adds a devtools panel that records the inspected page's requests in
SQLite and runs the SQL you type.

## Edge Add-ons

### Certification notes

Open the developer tools on any page, choose the Requests tab, and run
the query in the box. The table should list requests from that page.
No test account is required. Request logs never leave the browser.

## Version history

- 1.0.0 (unreleased): initial version from the devtools-typescript-sqlite template.
  Not yet submitted to any store.
