<script lang="ts" setup>
import {onMounted, ref} from 'vue'
import vueLogo from '../images/vue.png'

const inspectedTitle = ref('Reading the inspected page...')

onMounted(() => {
  // chrome.devtools only exists when this page runs as a devtools panel.
  // Opened as a plain extension page, such as in a test, the namespace is
  // missing.
  if (chrome?.devtools?.inspectedWindow) {
    chrome.devtools.inspectedWindow.eval(
      'document.title',
      (result: string, error: unknown) => {
        if (error) {
          inspectedTitle.value = 'Could not read the inspected page.'
          return
        }
        inspectedTitle.value = result || 'The inspected page has no title.'
      }
    )
  } else {
    inspectedTitle.value =
      'Open this page from the Example tab of the browser devtools to read the inspected page.'
  }
})
</script>
<template>
  <header>
    <h1>
      <img class="logo" :src="vueLogo" alt="Vue logo" width="40px" />
      <br />
      Welcome to your Vue Devtools Panel
    </h1>
    <p>
      Learn more in the
      <a href="https://extension.js.org" target="_blank" rel="noopener noreferrer"
        >Extension.js docs</a
      >.
    </p>
  </header>
  <section class="card">
    <h2>Title of the inspected page</h2>
    <p id="inspected-title" class="inspected-title">{{ inspectedTitle }}</p>
  </section>
</template>
