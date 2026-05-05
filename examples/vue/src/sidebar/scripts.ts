console.log('[From the sidebar page context] Hello regular page!')
import {createApp} from 'vue'
import SidebarApp from './SidebarApp.vue'
import './styles.css'

const app = createApp(SidebarApp)
app.mount('#root')
