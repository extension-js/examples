import './styles.css'
import {createApp} from 'vue'
import OptionsApp from './OptionsApp.vue'

console.log('[From the options context] Hello from the options page!')

createApp(OptionsApp).mount('#app')
