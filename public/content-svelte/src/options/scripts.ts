import {mount} from 'svelte'
import './styles.css'
import OptionsApp from './OptionsApp.svelte'

console.log('[From the options context] Hello from the options page!')

const container = document.getElementById('app') as HTMLElement | null
if (container) {
  mount(OptionsApp, {target: container})
}

export {}
