import {useSignal} from '@preact/signals'
import {useEffect} from 'preact/hooks'
import preactLogo from '../images/preact.png'

const FALLBACK_MESSAGE =
  'Open this page from the Example tab of the browser devtools to read the inspected page.'

export default function PanelApp() {
  const inspectedTitle = useSignal('Reading the inspected page...')

  useEffect(() => {
    // chrome.devtools only exists when this page runs as a devtools panel.
    // Opened as a plain extension page, such as in a test, the namespace is
    // missing, so the panel says so instead of throwing.
    if (!chrome?.devtools?.inspectedWindow) {
      inspectedTitle.value = FALLBACK_MESSAGE
      return
    }

    chrome.devtools.inspectedWindow.eval(
      'document.title',
      (result: string, error) => {
        if (error) {
          inspectedTitle.value = 'Could not read the inspected page.'
          return
        }
        inspectedTitle.value = result || 'The inspected page has no title.'
      }
    )
  }, [])

  return (
    <>
      <header>
        <h1>
          <img
            className="logo"
            src={preactLogo}
            alt="Preact logo"
            width="40px"
          />
          <br />
          Welcome to your Preact Devtools Panel
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
          {inspectedTitle.value}
        </p>
      </section>
    </>
  )
}
