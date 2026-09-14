import logo from '../images/icon.png'

function SidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  const app = document.createElement('div')
  app.className = 'sidebar_app'

  const image = document.createElement('img')
  image.className = 'sidebar_logo'
  image.src = logo
  image.alt = 'The Extension.js logo'

  const title = document.createElement('h1')
  title.className = 'sidebar_title'
  title.textContent = 'Sidebar Panel'

  const link = document.createElement('a')
  link.href = 'https://extension.js.org'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'Extension.js docs'

  const description = document.createElement('p')
  description.className = 'sidebar_description'
  description.append('Learn more in the ', link, ' .')

  app.append(image, title, description)
  root.replaceChildren(app)
}

SidebarApp()
