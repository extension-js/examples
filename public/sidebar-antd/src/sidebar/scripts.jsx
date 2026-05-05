console.log('[From the sidebar page context] Hello regular page!')
import React from 'react'
import {createRoot} from 'react-dom/client'
import SidebarApp from './SidebarApp.jsx'
import './styles.css'

const root = createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>
)
