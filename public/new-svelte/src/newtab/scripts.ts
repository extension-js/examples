console.log('[From the newtab override context] Hello regular page!')
import {mount} from 'svelte'
import './styles.css'
import App from './NewTabApp.svelte'

const container = document.getElementById('app') as HTMLElement | null
if (container) {
  mount(App, {target: container})
}

export {}
