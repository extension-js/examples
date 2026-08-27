import {mount} from 'svelte'
import './styles.css'
import PanelApp from './PanelApp.svelte'

console.log('[From the devtools panel context] Hello from the panel!')

const container = document.getElementById('app') as HTMLElement | null
if (container) {
  mount(PanelApp, {target: container})
}

export {}
