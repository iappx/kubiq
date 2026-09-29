<template>
  <port-forward-form
      :busy="saving"
      :forward="forward"
      :open="open"
      :request="request"
      @cancel="close"
      @submit="save($event)"
  />
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import PortForwardForm from '@/components/terminal/PortForwardForm.vue'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { PortForwardForm },
})
export default class PortForwardModal extends VueBase {
  public open = false

  public request: OpenPortForwardEvent | null = null

  public forwardId = ''

  public saving = false

  private onOpenRequested!: (event: OpenPortForwardEvent) => void

  constructor(
      @inject(PortForwardStore) public readonly portForwardStore: PortForwardStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get forward(): TPortForward | null {
    return this.forwardId === '' ? null : this.portForwardStore.find(this.forwardId) ?? null
  }

  created(): void {
    this.onOpenRequested = event => this.show(event)
    this.eventBus.registerHandler(OpenPortForwardEvent, this.onOpenRequested)
  }

  beforeUnmount(): void {
    this.eventBus.unregisterHandler(OpenPortForwardEvent, this.onOpenRequested)
  }

  public close(): void {
    if (this.saving) {
      return
    }

    this.open = false
  }

  public async save(request: TPortForwardRequest): Promise<void> {
    this.saving = true
    try {
      const saved = this.forwardId === ''
        ? await this.portForwardStore.create(request) !== null
        : await this.portForwardStore.update(this.forwardId, {
          remotePort: request.remotePort,
          localPort: request.localPort,
          restoreMode: request.restoreMode,
        })

      if (saved) {
        this.open = false
      }
    } finally {
      this.saving = false
    }
  }

  private show(event: OpenPortForwardEvent): void {
    if (this.saving || (event.isEdit && !this.portForwardStore.find(event.forwardId))) {
      return
    }

    this.forwardId = event.forwardId
    this.request = event
    this.open = true
  }
}
</script>
