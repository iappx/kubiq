<template>
  <transition name="splash" @after-leave="$emit('finish')">
    <div
        v-if="loading"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-background"
    >
      <div class="flex flex-col items-center gap-5">
        <app-logo size="lg" />
        <loader-circle :size="20" class="animate-spin text-muted-foreground" />
      </div>
    </div>
    <div v-else>
      <slot />
    </div>
  </transition>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle } from '@lucide/vue'
import AppLogo from '@/components/app/AppLogo.vue'

@Component({
  components: { AppLogo, LoaderCircle },
  emits: ['finish'],
})
export default class AppLoading extends VueBase {
  public loading = true

  mounted(): void {
    this.loading = false
  }
}
</script>

<style scoped>
.splash-leave-active {
  transition: opacity 0.3s ease;
}

.splash-leave-to {
  opacity: 0;
}
</style>
