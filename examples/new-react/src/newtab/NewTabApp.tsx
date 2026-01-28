import './styles.css'
import iconUrl from '../images/icon.png'

const reactLogo = iconUrl

export default function NewTabApp() {
  return (
    <header>
      <h1>
        <img
          className="react"
          src={reactLogo}
          alt="The React logo"
          width="120px"
        />
        <br />
        Welcome to your React Extension.
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
  )
}
