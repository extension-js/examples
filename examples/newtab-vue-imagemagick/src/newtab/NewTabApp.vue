<script setup lang="ts">
import {RouterLink, RouterView} from 'vue-router'
</script>

<template>
  <header>
    <div class="wrapper">
      <h1>ImageMagick WebAssembly</h1>
      <nav>
        <a href="https://github.com/dlemstra/magick-wasm-docs"
          ><img alt="Github logo" src="./assets/github.svg"
        /></a>
        |
        <RouterLink to="/">Home</RouterLink>
        |
        <RouterLink to="/classes/magick">Magick</RouterLink>
        |
        <RouterLink to="/classes/magick-image">MagickImage</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>
