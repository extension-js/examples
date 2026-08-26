import {useSignal} from '@preact/signals'
import {useEffect} from 'preact/hooks'
import preactLogo from '../images/preact.png'

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

export default function OptionsApp() {
  const showBadge = useSignal(DEFAULT_VALUE)
  const status = useSignal('Loading your setting...')

  useEffect(() => {
    // The key is absent until the first write, so ask storage for the default too.
    chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
      showBadge.value = Boolean(settings[SETTING_KEY])
      status.value = 'Setting loaded from chrome.storage.sync'
    })
  }, [])

  function onToggle(event: Event) {
    const checked = (event.currentTarget as HTMLInputElement).checked
    showBadge.value = checked
    // The content script listens for this write, so the overlay follows the
    // checkbox on every open page without a reload.
    chrome.storage.sync.set({[SETTING_KEY]: checked}, () => {
      status.value = `Saved: the overlay is ${checked ? 'on' : 'off'}`
    })
  }

  return (
    <main className="mx-auto max-w-xl p-8 text-gray-300">
      <img alt="Preact logo" src={preactLogo} className="inline-block w-16" />
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
        Preact Options
      </h1>
      <p className="mt-4 text-lg leading-8 text-gray-300">
        This page and the overlay share one setting, saved in
        chrome.storage.sync.
      </p>
      <label
        className="mt-8 flex items-center gap-3 text-lg text-white"
        htmlFor="show-badge"
      >
        <input
          type="checkbox"
          id="show-badge"
          className="h-5 w-5 accent-blue-500"
          checked={showBadge.value}
          onChange={onToggle}
        />
        Show the overlay on web pages
      </label>
      <p id="status" className="mt-4 text-sm text-gray-400" role="status">
        {status.value}
      </p>
    </main>
  )
}
