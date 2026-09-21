<template>
  <div class="min-h-screen bg-background flex items-center justify-center">
    <div class="flex flex-col items-center text-center">
      <div class="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
        <FileX :size="36" class="text-primary/60" />
      </div>
      <h1 class="text-6xl font-bold text-foreground mb-2">404</h1>
      <p class="text-muted-foreground mb-8">This page does not exist.</p>
      <button class="btn-primary" @click="goBack">
        Go to home
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { FileX } from '@lucide/vue'

@Component({
  components: { FileX },
})
export default class Error extends VueBase {
  goBack(): void {
    this.$router.push('/')
  }
}
</script>
