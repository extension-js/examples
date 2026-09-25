<script setup lang="ts">
import 'simple-syntax-highlighter/dist/sshpre.css'
import SshPre from 'simple-syntax-highlighter'

defineProps<{
  code: string
}>()
</script>

<template>
  <ssh-pre language="js" :dark="true">{{ code }}</ssh-pre>
</template>
