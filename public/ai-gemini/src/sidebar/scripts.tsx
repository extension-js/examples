import React from 'react'
import ReactDOM from 'react-dom/client'
import SidebarApp from './SidebarApp'
import './styles.css'

console.log('[From the sidebar page context] Hello regular page!')

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>
)
