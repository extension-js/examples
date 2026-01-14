import {mount} from 'svelte'
import './styles.css'
import App from './NewTabApp.svelte'

const container = document.getElementById('app') as HTMLElement | null
if (container) {
  mount(App, {target: container})
}

export {}
