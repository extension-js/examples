import {createApp} from 'vue'
import SidebarApp from './SidebarApp.vue'
import './styles.css'

console.log('[From the sidebar page context] Hello from the sidebar page!')

const app = createApp(SidebarApp)
app.mount('#root')
