import React from 'react'
import extensionLogo from '../images/icon.png'

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

export default function OptionsApp() {
  const [showBadge, setShowBadge] = React.useState(DEFAULT_VALUE)
  const [status, setStatus] = React.useState('Loading your setting...')

  React.useEffect(() => {
    // The key is absent until the first write, so ask storage for the default too.
    chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
      setShowBadge(Boolean(settings[SETTING_KEY]))
      setStatus('Setting loaded from chrome.storage.sync')
    })
  }, [])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.checked
    setShowBadge(nextValue)
    chrome.storage.sync.set({[SETTING_KEY]: nextValue}, () => {
      setStatus(`Saved: the overlay is ${nextValue ? 'on' : 'off'}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header>
        <img
          alt="Extension icon"
          src={extensionLogo}
          className="inline-block w-16"
        />
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
          React Content Options
        </h1>
        <p className="mt-3 text-base leading-7 text-gray-400">
          The overlay this extension injects into every page is the setting
          below, saved here and read back by the content script.
        </p>
      </header>
      <main className="mt-8 rounded-xl bg-gray-900 p-6 ring-1 ring-white/10">
        <label
          className="flex cursor-pointer items-center gap-3 text-base text-gray-100"
          htmlFor="show-badge"
        >
          <input
            id="show-badge"
            type="checkbox"
            checked={showBadge}
            onChange={handleChange}
            className="h-5 w-5 accent-blue-600"
          />
          Show the overlay on web pages
        </label>
        <p id="status" role="status" className="mt-4 text-sm text-gray-400">
          {status}
        </p>
      </main>
    </div>
  )
}
