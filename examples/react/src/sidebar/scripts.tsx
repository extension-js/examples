import {createRoot} from 'react-dom/client'
import SidebarApp from './SidebarApp'
import './styles.css'

console.log('[From the sidebar page context] Hello from the sidebar page!')

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Sidebar root element not found')
}

const reactRoot = createRoot(rootElement as HTMLElement)
reactRoot.render(<SidebarApp />)
