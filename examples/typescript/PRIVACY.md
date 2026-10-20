# TypeScript Sidebar Example privacy policy

Last updated: 2026-10-20

- Collected: nothing. The extension sends no user data to any server, has
  no account or sign-in, and runs no analytics.
- sidePanel (Chromium only): opens the extension's interface in the
  browser side panel; it reads no page data by itself.
- tabs: reads the title and address of the open tab so the interface can
  say which page it refers to.
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
