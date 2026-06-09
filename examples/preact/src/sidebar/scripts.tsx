import {render} from 'preact'
import SidebarApp from './SidebarApp'
import './styles.css'

console.log('[From the sidebar page context] Hello regular page!')

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Sidebar root element not found')
}
render(<SidebarApp />, rootElement as HTMLElement)
