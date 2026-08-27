import React from 'react'
import ReactDOM from 'react-dom/client'
import PanelApp from './PanelApp'
import './styles.css'

console.log('[From the devtools panel context] Hello from the panel!')

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <PanelApp />
  </React.StrictMode>
)
