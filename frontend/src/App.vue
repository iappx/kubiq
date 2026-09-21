<template>
  <div>
    <router-progress-bar />
    <router-view />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import RouterProgressBar from '@/components/app/RouterProgressBar.vue'

@Component({ components: { RouterProgressBar } })
export default class App extends VueBase {
}
</script>
