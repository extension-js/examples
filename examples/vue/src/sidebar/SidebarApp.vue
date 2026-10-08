<template>
  <div class="sidebar_app">
    <img class="sidebar_logo" :src="vueLogo" alt="The Vue logo" />
    <h1 class="sidebar_title">Sidebar Panel</h1>
    <p class="sidebar_description">
      Learn more in the
      <a href="https://extension.js.org" target="_blank" rel="noopener noreferrer">Extension.js docs</a>.
    </p>
    <p class="sidebar_page_title">{{ pageTitle }}</p>
  </div>
</template>

<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue'
import vueLogo from '../images/icon.png'
import {watchPageTitle} from './page-title'

const NO_PAGE_TEXT = 'Open a web page to see its title here.'

const pageTitle = ref(NO_PAGE_TEXT)
let stopWatching = () => {}

onMounted(() => {
  stopWatching = watchPageTitle((answer) => {
    pageTitle.value = answer ? answer.title : NO_PAGE_TEXT
  })
})

onBeforeUnmount(() => stopWatching())
</script>
