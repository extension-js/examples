import React from 'react'
import extensionLogo from '../images/icon.png'

const FALLBACK_MESSAGE =
  'Open this page from the Example tab of the browser devtools to read the inspected page.'

export default function PanelApp() {
  const [inspectedTitle, setInspectedTitle] = React.useState(
    'Reading the inspected page...'
  )

  React.useEffect(() => {
    // chrome.devtools only exists when this page runs as a devtools panel.
    // Opened as a plain extension page, such as in a test, it is missing.
    if (!chrome?.devtools?.inspectedWindow) {
      setInspectedTitle(FALLBACK_MESSAGE)
      return
    }

    chrome.devtools.inspectedWindow.eval<string>(
      'document.title',
      (result, error) => {
        if (error) {
          setInspectedTitle('Could not read the inspected page.')
          return
        }
        setInspectedTitle(result || 'The inspected page has no title.')
      }
    )
  }, [])

  return (
    <>
      <header>
        <h1>
          <img
            className="logo"
            src={extensionLogo}
            alt="Extension icon"
            width="72px"
          />
          <br />
          Welcome to your React Devtools Panel
        </h1>
        <p>
          Learn more in the{' '}
          <a
            href="https://extension.js.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Extension.js docs
          </a>
          .
        </p>
      </header>
      <section className="card">
        <h2>Title of the inspected page</h2>
        <p id="inspected-title" className="inspected-title">
          {inspectedTitle}
        </p>
      </section>
    </>
  )
}
