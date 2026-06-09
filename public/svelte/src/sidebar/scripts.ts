import {mount} from 'svelte'
import SidebarApp from './SidebarApp.svelte'
import './styles.css'

console.log('[From the sidebar page context] Hello regular page!')

const container = document.getElementById('app')

if (container) {
  mount(SidebarApp, {
    target: container
  })
}
