<script>
import vueLogo from '../images/icon.png'
import {defineComponent} from 'vue'

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

export default defineComponent({
  name: 'ContentApp',
  setup() {
    const openSidebar = () => {
      chrome.runtime.sendMessage({type: 'openSidebar'})
    }

    return {vueLogo, openSidebar, isFirefoxLike}
  }
})
</script>

<template>
  <!-- Firefox cannot open a sidebar from a message listener, so the gecko build
       renders a hint naming the toolbar action instead of a dead control. -->
  <div v-if="isFirefoxLike" class="content_pill content_pill_static">
    <img class="content_pill_logo" :src="vueLogo" alt="" aria-hidden="true" />
    <span class="content_pill_text">Use the toolbar icon to open the sidebar</span>
  </div>
  <button
    v-else
    type="button"
    class="content_pill"
    aria-label="Open sidebar"
    @click="openSidebar"
  >
    <img class="content_pill_logo" :src="vueLogo" alt="" aria-hidden="true" />
    <span class="content_pill_text">Open sidebar</span>
  </button>
</template>
