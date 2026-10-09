import {mount} from 'svelte'
import './styles.css'
import App from './NewTabApp.svelte'

console.log('[From the newtab override context] Hello from the new tab page!')

const container = document.getElementById('app') as HTMLElement | null

if (container) {
  mount(App, {target: container})
}

export {}
