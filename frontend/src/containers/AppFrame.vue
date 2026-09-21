<template>
  <app-loading>
    <div class="h-screen flex flex-col overflow-hidden bg-background">
      <top-nav />
      <div class="flex flex-1 min-h-0 min-w-0">
        <slot />
      </div>
    </div>
    <app-modals />
  </app-loading>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import AppLoading from '@/components/app/AppLoading.vue'
import AppModals from '@/components/app/AppModals.vue'
import TopNav from '@/containers/TopNav.vue'
import { ShellKeymap } from '@/components/clusterShell/ShellKeymap'
import { UiKeyboard } from '@/components/common/UiKeyboard'
import { OpenCommandPaletteEvent } from '@/domain/events/app/OpenCommandPaletteEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'

@Component({
  components: { AppLoading, AppModals, TopNav },
})
export default class AppFrame extends VueBase {
  private onShellKey!: (event: KeyboardEvent) => void

  constructor(
      @inject(AppUiStore) private readonly uiStore: AppUiStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  created(): void {
    this.onShellKey = (event) => {
      const command = ShellKeymap.command(event, UiKeyboard.isTyping(event.target))
      if (command === 'palette') {
        event.preventDefault()
        this.eventBus.emitEvent(new OpenCommandPaletteEvent())
        return
      }
      if (command === 'sidebar') {
        event.preventDefault()
        this.uiStore.toggleSidebar()
      }
    }

    document.addEventListener('keydown', this.onShellKey)
  }

  beforeUnmount(): void {
    document.removeEventListener('keydown', this.onShellKey)
  }
}
</script>
