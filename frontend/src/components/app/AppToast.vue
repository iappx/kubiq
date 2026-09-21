<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      <TransitionGroup name="toast">
        <div
            v-for="item in toastStore.items"
            :key="item.id"
            class="surface-raised px-4 py-3 flex items-start gap-3 pointer-events-auto"
        >
          <component
              :is="iconFor(item.type)"
              :class="colorFor(item.type)"
              :size="16"
              class="mt-0.5 shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground">
              {{ item.message }}
              <span
                  v-if="repeatsOf(item) > 1"
                  :aria-label="`Seen ${repeatsOf(item)} times`"
                  class="pill ml-1 align-middle"
              >×{{ repeatsOf(item) }}</span>
            </p>
            <p v-if="item.description" class="text-xs text-muted-foreground mt-0.5">{{ item.description }}</p>
          </div>
          <button aria-label="Dismiss notification" class="btn-icon w-6 h-6 shrink-0" type="button" @click="toastStore.remove(item.id)">
            <x :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { CircleAlert, TriangleAlert, CircleCheck, Info, X } from '@lucide/vue'
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { ToastStore } from '@/store/modules/toast/ToastStore'
import type { TToast } from '@/application/services/toast/types/TToast'

@Component({
  components: { X },
})
export default class AppToast extends VueBase {
  constructor(
      @inject(ToastStore) public readonly toastStore: ToastStore,
  ) {
    super()
  }

  public repeatsOf(toast: TToast): number {
    return toast.count ?? 1
  }

  public iconFor(type: string): VueComponent {
    switch (type) {
      case 'success': return CircleCheck
      case 'error': return CircleAlert
      case 'warning': return TriangleAlert
      default: return Info
    }
  }

  public colorFor(type: string): string {
    switch (type) {
      case 'success': return 'text-success'
      case 'error': return 'text-destructive'
      case 'warning': return 'text-warning'
      default: return 'text-primary'
    }
  }
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
