import logo from '../images/react.png'

export default function ContentApp() {
  return (
    <div className="content_script">
      <img className="content_logo" src={logo} alt="React Logo" />
      <h1 className="content_title">React Extension</h1>
      <p className="content_description">
        This content script runs in the context of web pages.
        <br />
        Learn more about creating cross-browser extensions at{' '}
        <a
          href="https://extension.js.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://extension.js.org
        </a>
      </p>
    </div>
  )
}
