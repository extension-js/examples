import {render} from 'preact'
import NewTabApp from './NewTabApp'
import './styles.css'

console.log('[From the newtab override context] Hello from the new tab page!')

render(<NewTabApp />, document.getElementById('root')!)
