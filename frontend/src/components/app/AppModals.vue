<template>
  <div>
    <app-toast />
    <command-palette />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import AppToast from '@/components/app/AppToast.vue'
import CommandPalette from '@/components/clusterShell/CommandPalette.vue'

@Component({
  components: { AppToast, CommandPalette },
})
export default class AppModals extends VueBase {
}
</script>
