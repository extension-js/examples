<script lang="ts">
import iconUrl from '../images/icon.png'
let message = 'Welcome to your Svelte Extension.'
</script>

<header>
  <h1><img class="svelte" src={iconUrl} alt="The Svelte logo" width="120px" />
    <br />
    {message}
  </h1>
  <p>
    Learn more in the
    <a href="https://extension.js.org" target="_blank" rel="noopener noreferrer">
      Extension.js docs
    </a>.
  </p>
  <p class="edit-hint">
    Edit <code>src/newtab/NewTabApp.svelte</code> and save to see your changes.
  </p>
</header>
