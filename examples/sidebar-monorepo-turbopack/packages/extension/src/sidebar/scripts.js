import renderSidebar from './SidebarApp.js'

console.log('[From the sidebar page context] Hello regular page!')

const root = document.getElementById('root')
if (root) renderSidebar(root)
