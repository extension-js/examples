export default function renderSidebar(root) {
  const header = document.createElement('header')

  const title = document.createElement('h1')
  title.textContent = 'Monorepo Sidebar'

  const description = document.createElement('p')
  description.textContent = 'Monorepo Turborepo example sidebar.'

  header.append(title, description)
  root.replaceChildren(header)
}
