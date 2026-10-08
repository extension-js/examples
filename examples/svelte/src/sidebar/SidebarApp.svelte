<script lang="ts">
import {onMount} from 'svelte'
import logo from '../images/icon.png'
import {watchPageTitle} from './page-title'

const NO_PAGE_TEXT = 'Open a web page to see its title here.'

let pageTitle = $state(NO_PAGE_TEXT)

onMount(() =>
  watchPageTitle((answer) => {
    pageTitle = answer ? answer.title : NO_PAGE_TEXT
  })
)
</script>

<div class="sidebar_app">
  <img class="sidebar_logo" src={logo} alt="The Svelte logo" />
  <h1 class="sidebar_title">Sidebar Panel</h1>
  <p class="sidebar_description">
    Learn more in the
    <a
      href="https://extension.js.org"
      target="_blank"
      rel="noopener noreferrer"
    >Extension.js docs</a>.
  </p>
  <p class="sidebar_page_title">{pageTitle}</p>
</div>
