import {createRoot} from 'react-dom/client'
import SidebarApp from './SidebarApp.js'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Sidebar root element not found')
}

const reactRoot = createRoot(rootElement as HTMLElement)
reactRoot.render(<SidebarApp />)
