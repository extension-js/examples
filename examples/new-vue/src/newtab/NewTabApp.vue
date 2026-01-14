<script lang="ts">
export default {
  data() {
    return {
      message: 'Welcome to your Vue Extension.'
    }
  }
}
</script>
<template>
  <header>
    <h1>
      <img
        class="vue"
        src="../images/vue.png"
        alt="The Vue logo"
        width="120px"
      />
      <br />
      {{message}}
    </h1>
    <p>
      Learn more in the 
      <a href="https://extension.js.org" target="_blank" rel="noopener noreferrer">Extension.js docs</a>
      .
    </p>
  </header>
</template>
