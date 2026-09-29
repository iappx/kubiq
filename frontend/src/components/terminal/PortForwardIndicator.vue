<template>
  <ui-popover v-if="visible" v-model:open="isOpen" label="Port forwards">
    <template #trigger>
      <button
          :aria-label="`Port forwards: ${summary}`"
          :class="chipClass"
          :title="`Port forwards: ${summary}`"
          class="ui-switcher"
          type="button"
      >
        <ui-status-dot v-if="alarming" :size="8" :tone="tone" />
        <cable :size="18" aria-hidden="true" />
        <span class="tabular">{{ portForwardStore.activeCount }}</span>
      </button>
    </template>

    <div class="flex min-h-0 w-md max-w-full flex-col">
      <header class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 class="text-sm font-medium text-foreground">Port forwards</h2>
        <span class="text-xs text-muted-foreground">{{ summary }}</span>
      </header>

      <div class="min-h-0 overflow-y-auto pb-1">
        <port-forward-cluster-group
            v-for="group in groups"
            :key="group.clusterId"
            :group="group"
            @dismiss="isOpen = false"
        />
      </div>
    </div>
  </ui-popover>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Cable } from '@lucide/vue'
import UiPopover from '@/components/common/popover/UiPopover.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import PortForwardClusterGroup from '@/components/terminal/PortForwardClusterGroup.vue'
import { PortForwardListBuilder } from '@/components/terminal/PortForwardListBuilder'
import { PortForwardTone } from '@/components/terminal/PortForwardTone'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TPortForwardGroup } from '@/components/terminal/types/TPortForwardGroup'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { Cable, PortForwardClusterGroup, UiPopover, UiStatusDot },
})
export default class PortForwardIndicator extends VueBase {
  public isOpen = false

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
  ) {
    super()
  }

  public get visible(): boolean {
    return this.portForwardStore.forwards.length > 0
  }

  public get groups(): TPortForwardGroup[] {
    return PortForwardListBuilder.groups(this.portForwardStore.forwards)
  }

  public get summary(): string {
    return PortForwardListBuilder.summary(this.portForwardStore.forwards)
  }

  public get tone(): TUiTone {
    return PortForwardTone.summary(this.portForwardStore.forwards)
  }

  public get alarming(): boolean {
    return PortForwardTone.isAlarming(this.tone)
  }

  public get chipClass(): string {
    if (this.tone === 'error') {
      return 'text-destructive border-destructive/30 bg-destructive/10'
    }
    if (this.tone === 'warning') {
      return 'text-warning border-warning/30 bg-warning/10'
    }

    return this.portForwardStore.activeCount > 0 ? '' : 'text-muted-foreground'
  }
}
</script>
