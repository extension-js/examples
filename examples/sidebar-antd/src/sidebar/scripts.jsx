import React from 'react'
import {createRoot} from 'react-dom/client'
import SidebarApp from './SidebarApp.jsx'

const root = createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>
)
