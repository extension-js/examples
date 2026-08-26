import {render} from 'preact'
import PanelApp from './PanelApp'
import './styles.css'

console.log('[From the devtools panel context] Hello from the panel!')

render(<PanelApp />, document.getElementById('root')!)
