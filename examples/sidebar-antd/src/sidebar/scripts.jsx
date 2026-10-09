import React from 'react'
import {createRoot} from 'react-dom/client'
import SidebarApp from './SidebarApp.jsx'
import './styles.css'

console.log('[From the sidebar page context] Hello from the sidebar page!')

const root = createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>
)
