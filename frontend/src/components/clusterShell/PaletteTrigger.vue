<template>
  <button
      aria-label="Open the command palette"
      class="ui-palette-trigger"
      title="Open the command palette"
      type="button"
      @click="open"
  >
    <search :size="14" aria-hidden="true" class="text-muted-foreground shrink-0" />
    <span class="text-muted-foreground">Go to</span>
    <kbd class="ui-kbd">{{ shortcut }}</kbd>
  </button>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Search } from '@lucide/vue'
import { OpenCommandPaletteEvent } from '@/domain/events/app/OpenCommandPaletteEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@Component({
  components: { Search },
})
export default class PaletteTrigger extends VueBase {
  constructor(
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get shortcut(): string {
    const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent

    return /Mac|iPhone|iPad/.test(agent) ? '⌘K' : 'Ctrl K'
  }

  public open(): void {
    this.eventBus.emitEvent(new OpenCommandPaletteEvent())
  }
}
</script>
