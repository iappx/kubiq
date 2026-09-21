<template>
  <div class="port-forward-row">
    <ui-status-dot :label="stateLabel" :tone="tone" />

    <span class="truncate text-sm text-foreground">{{ forward.label }}</span>

    <span class="tabular text-xs text-muted-foreground">{{ address }}</span>

    <span v-if="forward.failure" class="truncate text-xs text-destructive">{{ forward.failure }}</span>

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <button
          :aria-label="`Open ${address} in the browser`"
          :title="`Open ${address} in the browser`"
          class="btn-icon w-7 h-7"
          type="button"
          @click="$emit('open', forward.forwardId)"
      >
        <external-link :size="14" />
      </button>

      <button
          :aria-label="`Stop forwarding ${forward.label}`"
          :title="`Stop forwarding ${forward.label}`"
          class="btn-icon w-7 h-7"
          type="button"
          @click="$emit('stop', forward.forwardId)"
      >
        <square :size="14" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ExternalLink, Square } from '@lucide/vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'

@Component({
  components: { ExternalLink, Square, UiStatusDot },
  emits: ['open', 'stop'],
})
export default class PortForwardRow extends VueBase {
  @Prop({ required: true })
  public readonly forward: TPortForward

  public get tone(): TUiTone {
    return this.forward.state === 'failed' ? 'error' : 'ok'
  }

  public get stateLabel(): string {
    return this.forward.state === 'failed' ? 'Failed' : 'Forwarding'
  }

  public get address(): string {
    return `${this.forward.address}:${this.forward.localPort}`
  }
}
</script>

<style scoped>
.port-forward-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding-inline: 16px;
  border-bottom: 1px solid hsl(var(--border));
}
</style>
