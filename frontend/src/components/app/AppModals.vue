<template>
  <div>
    <!--
      Global modal host.

      Modals that are opened from anywhere via the event bus are mounted here once,
      instead of being duplicated inside every page that can open them.
      Register your own modals below.
    -->
    <app-toast />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import AppToast from '@/components/app/AppToast.vue'

@Component({
  components: { AppToast },
})
export default class AppModals extends VueBase {
}
</script>
