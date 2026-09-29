<template>
  <div class="space-y-1">
    <div class="flex items-center gap-2">
      <ui-status-badge :label="statusLabel" :tone="tone" class="shrink-0 text-xs" />

      <span v-if="address" class="min-w-0 flex-1 truncate font-mono text-xs text-foreground" :title="address">
        {{ address }}
      </span>
      <span v-else class="min-w-0 flex-1 truncate text-xs text-muted-foreground">Any free local port</span>

      <button
          :aria-label="openLabel"
          :disabled="!listening"
          :title="openLabel"
          class="btn-icon h-7 w-7 shrink-0 disabled:opacity-50"
          type="button"
          @click="portForwardStore.open(forward.id)"
      >
        <external-link :size="14" />
      </button>

      <button
          :aria-label="copyLabel"
          :disabled="!address"
          :title="copyLabel"
          class="btn-icon h-7 w-7 shrink-0 disabled:opacity-50"
          type="button"
          @click="portForwardStore.copyAddress(forward.id)"
      >
        <copy :size="14" />
      </button>

      <button
          v-if="stoppable"
          :aria-label="stopLabel"
          :title="stopLabel"
          class="btn-icon h-7 w-7 shrink-0"
          type="button"
          @click="portForwardStore.stop(forward.id)"
      >
        <square :size="14" />
      </button>

      <button
          v-else
          :aria-label="startLabel"
          :title="startLabel"
          class="btn-icon h-7 w-7 shrink-0"
          type="button"
          @click="portForwardStore.start(forward.id)"
      >
        <play :size="14" />
      </button>
    </div>

    <p v-if="forward.error" class="break-words text-xs text-destructive">{{ forward.error }}</p>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Copy, ExternalLink, Play, Square } from '@lucide/vue'
import { inject } from 'tsyringe'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { DetailPorts } from '@/components/resource/detail/DetailPorts'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { PortForwardStatusCatalog } from '@/domain/entities/portForward'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { Copy, ExternalLink, Play, Square, UiStatusBadge },
})
export default class ResourcePortForwardState extends VueBase {
  @Prop({ required: true })
  public readonly forward: TPortForward

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
  ) {
    super()
  }

  public get statusLabel(): string {
    return PortForwardStatusCatalog.title(this.forward.status)
  }

  public get tone(): TUiTone {
    return DetailPorts.toneOf(this.forward.status)
  }

  public get address(): string {
    return this.portForwardStore.addressOf(this.forward)
  }

  public get listening(): boolean {
    return PortForwardStatusCatalog.isListening(this.forward.status)
  }

  public get stoppable(): boolean {
    return PortForwardStatusCatalog.isRunning(this.forward.status) || this.forward.status === 'waiting'
  }

  public get openLabel(): string {
    return `Open ${this.forward.label} in the browser`
  }

  public get copyLabel(): string {
    return `Copy the local address of ${this.forward.label}`
  }

  public get stopLabel(): string {
    return `Stop forwarding ${this.forward.label}`
  }

  public get startLabel(): string {
    return `Start forwarding ${this.forward.label}`
  }
}
</script>
