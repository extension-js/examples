import {render} from 'preact'
import SidebarApp from './SidebarApp.js'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Sidebar root element not found')
}
render(<SidebarApp />, rootElement as HTMLElement)
