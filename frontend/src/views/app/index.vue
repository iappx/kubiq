<template>
  <app-frame>
    <main class="flex-1 min-w-0 min-h-0 overflow-hidden p-4">
      <router-view />
    </main>
  </app-frame>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import AppFrame from '@/containers/AppFrame.vue'

@Component({
  components: { AppFrame },
})
export default class AppBase extends VueBase {
}
</script>
