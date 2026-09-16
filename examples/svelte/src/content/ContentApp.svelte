<script>
import logo from '../images/icon.png'

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

function openSidebar() {
  chrome.runtime.sendMessage({type: 'openSidebar'})
}
</script>

<!-- Firefox cannot open a sidebar from a message listener, so the gecko build
     renders a hint naming the toolbar action instead of a dead control. -->
{#if isFirefoxLike}
  <div class="content_pill content_pill_static">
    <img class="content_pill_logo" src={logo} alt="" aria-hidden="true" />
    <span class="content_pill_text">Use the toolbar icon to open the sidebar</span>
  </div>
{:else}
  <button
    type="button"
    class="content_pill"
    aria-label="Open sidebar"
    on:click={openSidebar}
  >
    <img class="content_pill_logo" src={logo} alt="" aria-hidden="true" />
    <span class="content_pill_text">Open sidebar</span>
  </button>
{/if}
