<script lang="ts">
import svelteLogo from '../images/svelte.png'

let inspectedTitle = 'Reading the inspected page...'

// chrome.devtools only exists when this page runs as a devtools panel. Opened
// as a plain extension page, such as in a test, the namespace is missing.
if (chrome?.devtools?.inspectedWindow) {
  chrome.devtools.inspectedWindow.eval(
    'document.title',
    (result: string, error: unknown) => {
      if (error) {
        inspectedTitle = 'Could not read the inspected page.'
        return
      }
      inspectedTitle = result || 'The inspected page has no title.'
    }
  )
} else {
  inspectedTitle =
    'Open this page from the Example tab of the browser devtools to read the inspected page.'
}
</script>

<header>
  <h1>
    <img class="logo" src={svelteLogo} alt="Svelte logo" width="40px" />
    <br />
    Welcome to your Svelte Devtools Panel
  </h1>
  <p>
    Learn more in the
    <a href="https://extension.js.org" target="_blank" rel="noopener noreferrer">
      Extension.js docs
    </a>.
  </p>
</header>
<section class="card">
  <h2>Title of the inspected page</h2>
  <p id="inspected-title" class="inspected-title">{inspectedTitle}</p>
</section>
