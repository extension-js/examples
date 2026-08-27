<script lang="ts" setup>
import {onMounted, ref} from 'vue'
import iconUrl from '../images/icon.png'

type BadgePosition = 'left' | 'right'

const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE: BadgePosition = 'right'

const badgePosition = ref<BadgePosition>(DEFAULT_VALUE)
const status = ref('Loading your setting...')

onMounted(() => {
  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    badgePosition.value = settings[SETTING_KEY] === 'left' ? 'left' : 'right'
    status.value = 'Setting loaded from chrome.storage.sync'
  })
})

// The checkbox is not bound with v-model on purpose: the saved value is the
// source of truth, and it only moves once storage accepts the write.
function onToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const nextValue: BadgePosition = checked ? 'left' : 'right'
  chrome.storage.sync.set({[SETTING_KEY]: nextValue}, () => {
    badgePosition.value = nextValue
    status.value = `Saved: the overlay sits on the ${nextValue}`
  })
}
</script>
<template>
  <main class="mx-auto max-w-2xl p-8 text-gray-200">
    <header>
      <h1 class="text-3xl font-bold tracking-tight text-white">
        <img
          class="mb-6 inline-block w-16"
          :src="iconUrl"
          alt="Extension icon"
        />
        <br />
        Vue Content Options
      </h1>
      <p class="mt-4 text-base leading-7 text-gray-400">
        Learn more in the
        <a
          class="text-white underline hover:no-underline"
          href="https://extension.js.org"
          target="_blank"
          rel="noopener noreferrer"
          >Extension.js docs</a
        >.
      </p>
    </header>

    <p class="mt-8 border-l-4 border-blue-500 bg-gray-800 px-6 py-4 text-white">
      The overlay this extension injects into every page sits on the edge
      picked below, saved here and read back by the content script.
    </p>

    <label
      class="mt-6 flex cursor-pointer items-center gap-3 text-base"
      for="badge-left"
    >
      <input
        id="badge-left"
        type="checkbox"
        class="h-5 w-5 accent-blue-500"
        :checked="badgePosition === 'left'"
        @change="onToggle"
      />
      Show the badge on the left
    </label>

    <p id="status" class="mt-4 text-sm text-gray-400" role="status">
      {{ status }}
    </p>
  </main>
</template>
