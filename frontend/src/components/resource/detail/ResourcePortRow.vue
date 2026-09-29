<template>
  <li class="space-y-2 rounded-md border border-border px-3 py-2">
    <div class="flex items-center gap-2">
      <span class="shrink-0 font-mono text-xs font-medium tabular text-foreground">{{ port.port }}/{{ port.protocol }}</span>
      <span v-if="port.name" class="min-w-0 truncate text-xs text-muted-foreground" :title="port.name">{{ port.name }}</span>
      <span class="flex-1" />

      <button
          v-if="canForward"
          :aria-label="forwardLabel"
          :title="forwardLabel"
          class="btn-secondary h-7 shrink-0 px-2 text-xs"
          type="button"
          @click="$emit('forward', port)"
      >
        <cable :size="14" aria-hidden="true" />
        Forward
      </button>

      <span v-else-if="!port.forwardable" class="shrink-0 text-xs text-muted-foreground">
        {{ port.protocol }} cannot be forwarded
      </span>
    </div>

    <p v-if="detail" class="text-xs text-muted-foreground">{{ detail }}</p>

    <resource-port-forward-state v-if="forward" :forward="forward" />

    <resource-port-via-note v-for="through in via" :key="through.id" :forward="through" />
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Cable } from '@lucide/vue'
import ResourcePortForwardState from '@/components/resource/detail/ResourcePortForwardState.vue'
import ResourcePortViaNote from '@/components/resource/detail/ResourcePortViaNote.vue'
import type { TDetailPort } from '@/components/resource/detail/types/TDetailPort'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'

@Component({
  components: { Cable, ResourcePortForwardState, ResourcePortViaNote },
  emits: ['forward'],
})
export default class ResourcePortRow extends VueBase {
  @Prop({ required: true })
  public readonly port: TDetailPort

  @Prop({ required: false, default: null })
  public readonly forward?: TPortForward | null

  @Prop({ required: false, default: () => [] })
  public readonly via?: TPortForward[]

  public get canForward(): boolean {
    return this.port.forwardable && !this.forward
  }

  public get forwardLabel(): string {
    return `Forward port ${this.port.port}`
  }

  public get detail(): string {
    const parts: string[] = []
    if (this.port.container !== '') {
      parts.push(`Container ${this.port.container}`)
    }
    if (this.port.targetPort !== '') {
      parts.push(`Target ${this.port.targetPort}`)
    }
    if (this.port.nodePort > 0) {
      parts.push(`Node port ${this.port.nodePort}`)
    }

    return parts.join(' · ')
  }
}
</script>
