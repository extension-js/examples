import {useSignal} from '@preact/signals'
import {useEffect} from 'preact/hooks'
import preactLogo from '../images/preact.png'

type BadgePosition = 'left' | 'right'

const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE: BadgePosition = 'right'

export default function OptionsApp() {
  const badgePosition = useSignal<BadgePosition>(DEFAULT_VALUE)
  const status = useSignal('Loading your setting...')

  useEffect(() => {
    // The key is absent until the first write, so ask storage for the default too.
    chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
      badgePosition.value = settings[SETTING_KEY] === 'left' ? 'left' : 'right'
      status.value = 'Setting loaded from chrome.storage.sync'
    })
  }, [])

  function onToggle(event: Event) {
    const checked = (event.currentTarget as HTMLInputElement).checked
    const nextValue: BadgePosition = checked ? 'left' : 'right'
    badgePosition.value = nextValue
    // The content script listens for this write, so the overlay changes edge
    // on every open page without a reload.
    chrome.storage.sync.set({[SETTING_KEY]: nextValue}, () => {
      status.value = `Saved: the overlay sits on the ${nextValue}`
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
        htmlFor="badge-left"
      >
        <input
          type="checkbox"
          id="badge-left"
          className="h-5 w-5 accent-blue-500"
          checked={badgePosition.value === 'left'}
          onChange={onToggle}
        />
        Show the badge on the left
      </label>
      <p id="status" className="mt-4 text-sm text-gray-400" role="status">
        {status.value}
      </p>
    </main>
  )
}
