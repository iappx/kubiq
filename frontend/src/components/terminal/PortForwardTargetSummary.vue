<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
    <dt class="text-muted-foreground">Cluster</dt>
    <dd class="truncate text-foreground">{{ clusterId }}</dd>

    <dt class="text-muted-foreground">Namespace</dt>
    <dd class="truncate text-foreground">{{ namespace }}</dd>

    <dt class="text-muted-foreground">{{ kindTitle }}</dt>
    <dd class="truncate text-foreground">{{ name }}</dd>
  </dl>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'

@Component({})
export default class PortForwardTargetSummary extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly namespace: string

  @Prop({ required: true })
  public readonly resource: string

  @Prop({ required: true })
  public readonly name: string

  public get kindTitle(): string {
    return this.resource === PortForwardLabel.services ? 'Service' : 'Pod'
  }
}
</script>
