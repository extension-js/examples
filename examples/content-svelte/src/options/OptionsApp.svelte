<script lang="ts">
import iconUrl from '../images/icon.png'

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

let showBadge = DEFAULT_VALUE
let status = 'Loading your setting...'

// The key is absent until the first write, so ask storage for the default too.
chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
  showBadge = Boolean(settings[SETTING_KEY])
  status = 'Setting loaded from chrome.storage.sync'
})

// The content script listens for this write, so the overlay reacts while the
// options page is still open.
function saveSetting(event: Event) {
  const checkbox = event.currentTarget as HTMLInputElement
  showBadge = checkbox.checked
  chrome.storage.sync.set({[SETTING_KEY]: showBadge}, () => {
    status = `Saved: the overlay is ${showBadge ? 'on' : 'off'}`
  })
}
</script>

<main class="mx-auto max-w-2xl px-8 py-10 text-gray-300">
  <header>
    <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
      <img src={iconUrl} alt="Extension icon" class="mb-6 w-16" />
      Welcome to your Svelte Options Extension
    </h1>
    <p class="mt-6 text-lg leading-8">
      Learn more in the
      <a
        href="https://extension.js.org"
        target="_blank"
        rel="noopener noreferrer"
        class="underline hover:no-underline"
      >
        Extension.js docs
      </a>.
    </p>
  </header>
  <p class="mt-8 border-l-4 border-blue-500 bg-gray-900 px-6 py-4 text-white">
    The Svelte overlay this extension injects into every page is the setting
    below, saved here and read back by the content script.
  </p>
  <label
    for="show-badge"
    class="mt-8 flex cursor-pointer items-center gap-3 text-base"
  >
    <input
      id="show-badge"
      type="checkbox"
      class="h-5 w-5 accent-blue-500"
      checked={showBadge}
      on:change={saveSetting}
    />
    Show the overlay on web pages
  </label>
  <p id="status" role="status" class="mt-4 text-sm text-gray-400">{status}</p>
</main>
