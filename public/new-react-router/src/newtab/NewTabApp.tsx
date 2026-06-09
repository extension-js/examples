import {HashRouter as Router, Switch, Route, Link} from 'react-router-dom'
import './styles.css'
import reactLogo from '../images/icon.png'

function Page({heading}: {heading: string}) {
  return (
    <main>
      <h1>
        <img
          className="react"
          src={reactLogo}
          alt="The React logo"
          width="120px"
        />
        <br />
        {heading}
      </h1>
      <pre>
        <code>{window.location.href}</code>
      </pre>
    </main>
  )
}

export default function NewTabApp() {
  return (
    <Router>
      <div>
        <nav>
          <Link to="/">Home</Link> <Link to="/about">About</Link>{' '}
          <Link to="/users">Users</Link>
        </nav>

        <Switch>
          <Route path="/about">
            <Page heading="Learn more about your React Router DOM Extension." />
          </Route>
          <Route path="/users">
            <Page heading="List of users of your React Router DOM Extension." />
          </Route>
          <Route path="/">
            <Page heading="Welcome to your React Router Extension." />
          </Route>
        </Switch>
      </div>
    </Router>
  )
}
