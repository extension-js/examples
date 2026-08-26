import React from 'react'
import ReactDOM from 'react-dom/client'
import OptionsApp from './OptionsApp'
import './styles.css'

console.log('[From the options context] Hello from the options page!')

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
)
