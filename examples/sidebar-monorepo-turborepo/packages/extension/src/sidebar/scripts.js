import renderSidebar from './SidebarApp.js'

console.log('[From the sidebar page context] Hello from the sidebar page!')

const root = document.getElementById('root')
if (root) renderSidebar(root)
