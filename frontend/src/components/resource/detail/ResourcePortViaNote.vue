<template>
  <p class="flex items-center gap-1 text-xs text-muted-foreground">
    <cable :size="14" aria-hidden="true" class="shrink-0" />
    <span class="min-w-0 truncate" :title="text">
      Forwarded via service {{ forward.name }}<template v-if="address"> at <span class="font-mono text-foreground">{{ address }}</span></template>
    </span>
  </p>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Cable } from '@lucide/vue'
import { inject } from 'tsyringe'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@Component({
  components: { Cable },
})
export default class ResourcePortViaNote extends VueBase {
  @Prop({ required: true })
  public readonly forward: TPortForward

  constructor(
      @inject(PortForwardStore) private readonly portForwardStore: PortForwardStore,
  ) {
    super()
  }

  public get address(): string {
    return this.portForwardStore.addressOf(this.forward)
  }

  public get text(): string {
    const via = `Forwarded via service ${this.forward.name}`

    return this.address === '' ? via : `${via} at ${this.address}`
  }
}
</script>
