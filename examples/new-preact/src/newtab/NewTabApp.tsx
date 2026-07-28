import './styles.css'
import preactLogo from '../images/icon.png'

export default function ContentApp() {
  return (
    <header>
      <h1>
        <img
          className="preact"
          src={preactLogo}
          alt="The Preact logo"
          width="120px"
        />
        <br />
        Welcome to your Preact Extension.
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
      <p className="edit-hint">
        Edit <code>src/newtab/NewTabApp.tsx</code> and save to see your changes.
      </p>
    </header>
  )
}
