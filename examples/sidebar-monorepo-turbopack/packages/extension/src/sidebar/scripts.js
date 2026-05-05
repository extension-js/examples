console.log('[From the sidebar page context] Hello regular page!')
import renderSidebar from './SidebarApp.js'

const root = document.getElementById('root')
if (root) renderSidebar(root)
