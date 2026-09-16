import logo from '../images/icon.png'
const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

export default function ContentApp() {
  const handleClick = () => {
    chrome.runtime.sendMessage({type: 'openSidebar'})
  }

  // Firefox cannot open a sidebar from a message listener, so the gecko build
  // renders a hint naming the toolbar action instead of a control that cannot work.
  if (isFirefoxLike) {
    return (
      <div className="content_pill content_pill_static">
        <img
          className="content_pill_logo"
          src={logo}
          alt=""
          aria-hidden="true"
        />
        <span className="content_pill_text">
          Use the toolbar icon to open the sidebar
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="content_pill"
      onClick={handleClick}
      aria-label="Open sidebar"
    >
      <img className="content_pill_logo" src={logo} alt="" aria-hidden="true" />
      <span className="content_pill_text">Open sidebar</span>
    </button>
  )
}
