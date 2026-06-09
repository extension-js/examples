import logo from '../images/icon.png'
import {
  content_script,
  content_logo,
  content_title,
  content_description
} from './styles.module.scss'

console.log('[From the page context] Hello from content_scripts!')

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})

  const contentDiv = document.createElement('div')
  contentDiv.className = content_script
  shadowRoot.appendChild(contentDiv)

  const img = document.createElement('img')
  img.className = content_logo
  img.src = logo
  contentDiv.appendChild(img)

  const title = document.createElement('h1')
  title.className = content_title
  title.textContent = 'Content Template'
  contentDiv.appendChild(title)

  const description = document.createElement('p')
  description.className = content_description
  description.innerHTML =
    'This content script runs in the context of web pages. Learn more at <a href="https://extension.js.org" target="_blank" rel="noreferrer noopener">extension.js.org</a>.'
  contentDiv.appendChild(description)

  return () => {
    rootDiv.remove()
  }
}
