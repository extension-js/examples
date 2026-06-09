import './styles.css'
import {createApp} from 'vue'
import NewTabApp from './NewTabApp.vue'

console.log('[From the newtab override context] Hello regular page!')

createApp(NewTabApp).mount('#app')
