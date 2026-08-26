import {render} from 'preact'
import OptionsApp from './OptionsApp'
import './styles.css'

console.log('[From the options context] Hello from the options page!')

render(<OptionsApp />, document.getElementById('root')!)
