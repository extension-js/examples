console.log('[From the newtab override context] Hello regular page!')
import './styles.css'

import {createApp} from 'vue'
import NewTabApp from './NewTabApp.vue'

createApp(NewTabApp).mount('#app')
