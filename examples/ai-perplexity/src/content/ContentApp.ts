import iconUrl from '../images/icon.png'

const PRODUCT_NAME = 'Perplexity'

export default function createContentApp(): HTMLDivElement {
  const container = document.createElement('div')
  container.className = 'content_script'

  const pill = document.createElement('button')
  pill.type = 'button'
  pill.className = 'content_pill'
  pill.setAttribute('aria-label', `Open ${PRODUCT_NAME} sidebar`)
  pill.addEventListener('click', () => {
    if (import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox') {
      browser.runtime.sendMessage({type: 'openSidebar'})
    } else {
      chrome.runtime.sendMessage({type: 'openSidebar'})
    }
  })

  const img = document.createElement('img')
  img.className = 'content_pill_logo'
  img.src = iconUrl as unknown as string
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')

  const text = document.createElement('span')
  text.className = 'content_pill_text'
  text.textContent = `Ask ${PRODUCT_NAME}`

  pill.appendChild(img)
  pill.appendChild(text)
  container.appendChild(pill)

  return container
}
