import React from 'react'
import ReactDOM from 'react-dom/client'
import NewtabApp from './NewTabApp'
import './styles.css'

console.log('[From the newtab override context] Hello regular page!')

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <NewtabApp />
  </React.StrictMode>
)
