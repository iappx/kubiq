<template>
  <resource-section :hint="hint" title="Ports">
    <ul v-if="ports.length > 0" class="space-y-2">
      <resource-port-row
          v-for="port in ports"
          :key="port.key"
          :forward="forwardOf(port)"
          :port="port"
          :via="viaOf(port)"
          @forward="forward"
      />
    </ul>

    <div v-else class="flex items-center gap-2">
      <p class="min-w-0 flex-1 text-xs text-muted-foreground">{{ emptyText }}</p>

      <button class="btn-secondary h-7 shrink-0 px-2 text-xs" type="button" @click="forward(null)">
        <cable :size="14" aria-hidden="true" />
        Forward a port
      </button>
    </div>

    <div v-if="stray.length > 0" class="space-y-1 pt-1">
      <resource-port-via-note v-for="through in stray" :key="through.id" :forward="through" />
    </div>
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Cable } from '@lucide/vue'
import { inject } from 'tsyringe'
import ResourcePortRow from '@/components/resource/detail/ResourcePortRow.vue'
import ResourcePortViaNote from '@/components/resource/detail/ResourcePortViaNote.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { DetailPorts } from '@/components/resource/detail/DetailPorts'
import type { TDetailPort } from '@/components/resource/detail/types/TDetailPort'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { KubeWorkloadCatalog } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { Cable, ResourcePortRow, ResourcePortViaNote, ResourceSection },
})
export default class ResourcePortsSection extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  constructor(
      @inject(PortForwardStore) private readonly portForwardStore: PortForwardStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get isPod(): boolean {
    return KubeWorkloadCatalog.isPod(this.target.kind)
  }

  public get ports(): TDetailPort[] {
    return DetailPorts.of(this.state.object, this.target.kind)
  }

  public get throughPod(): TPortForward[] {
    return this.isPod
      ? this.portForwardStore.throughPod(this.target.clusterId, this.target.namespace, this.target.name)
      : []
  }

  public get stray(): TPortForward[] {
    return DetailPorts.unmatched(this.throughPod, this.ports)
  }

  public get forwardedCount(): number {
    return this.ports.filter(port => this.forwardOf(port) !== null).length
  }

  public get hint(): string {
    if (this.ports.length === 0) {
      return ''
    }

    const declared = `${this.ports.length} declared`

    return this.forwardedCount === 0 ? declared : `${declared} · ${this.forwardedCount} forwarded`
  }

  public get emptyText(): string {
    return this.isPod ? 'No container declares a port.' : 'This service declares no ports.'
  }

  public forwardOf(port: TDetailPort): TPortForward | null {
    return this.portForwardStore.findForPort(
      this.target.clusterId,
      this.target.namespace,
      this.target.kind.resource,
      this.target.name,
      port,
    ) ?? null
  }

  public viaOf(port: TDetailPort): TPortForward[] {
    return DetailPorts.via(this.throughPod, port)
  }

  public forward(port: TDetailPort | null): void {
    this.eventBus.emitEvent(new OpenPortForwardEvent(
      this.target.clusterId,
      this.target.namespace,
      this.target.kind.resource,
      this.target.name,
      port?.port ?? '',
    ))
  }
}
</script>
