import {createApp} from 'vue'
import ContentApp from './ContentApp.vue'

export default function initial() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})
  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)
  fetchCSS().then((css) => (styleElement.textContent = css))

  const container = document.createElement('div')
  container.className = 'content_script'
  shadowRoot.appendChild(container)
  const app = createApp(ContentApp)
  app.mount(container)
  return () => {
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
