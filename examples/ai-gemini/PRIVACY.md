# Gemini (Google) Sidebar privacy policy

Last updated: 2026-10-20

- Collected: The user's own API key for Google, kept in the browser's
  extension storage on the device and sent only to Google. The messages
  the user types into the extension, sent to Google to get an answer and
  only when the user sends them. The text of the page the user is viewing,
  sent to Google only when the user asks about that page.
- sidePanel (Chromium only): opens the extension's interface in the
  browser side panel; it reads no page data by itself.
- storage: keeps the extension's own settings, and anything the user types
  into its options, in the browser's extension storage on the user's
  device.
- tabs: reads the title and address of the open tab so the interface can
  say which page it refers to.
- Host access <all_urls>: lets the extension's content script run on the
  pages the user visits so its interface can appear there.
- Not collected: browsing history, activity on websites, location, search
  terms, bookmarks, payment details, health information, personal files,
  and usage analytics. Nothing else leaves the browser.
- Firefox data collection declaration: the manifest declares
  data_collection_permissions required: authenticationInfo,
  personalCommunications, websiteContent, which matches the lines above.
  If you add data collection, update the declaration, this section, and
  your privacy policy in the same change.
