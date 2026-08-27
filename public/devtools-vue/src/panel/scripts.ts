import './styles.css'
import {createApp} from 'vue'
import PanelApp from './PanelApp.vue'

console.log('[From the devtools panel context] Hello from the panel!')

createApp(PanelApp).mount('#app')
