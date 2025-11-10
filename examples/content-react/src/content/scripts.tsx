import ReactDOM from 'react-dom/client'
import ContentApp from './ContentApp'
import cssHref from './styles.css?url'

export default function initial() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})
  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)
  fetchCSS().then((css) => (styleElement.textContent = css))

  const mountingPoint = ReactDOM.createRoot(shadowRoot)
  mountingPoint.render(
    <div className="content_script">
      <ContentApp />
    </div>
  )
  return () => {
    mountingPoint.unmount()
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const href =
    (cssHref as unknown as {default?: string}).default ||
    (cssHref as unknown as string)
  const response = await fetch(href)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
