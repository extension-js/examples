console.log('[From the newtab override context] Hello regular page!')
import {render} from 'preact'
import NewTabApp from './NewTabApp'
import './styles.css'

render(<NewTabApp />, document.getElementById('root')!)
