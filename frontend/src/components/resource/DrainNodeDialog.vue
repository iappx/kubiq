<template>
  <confirm-dialog
      :description="description"
      :loading="busy"
      :open="open"
      :title="title"
      confirm-label="Cordon and drain"
      variant="danger"
      @cancel="$emit('cancel')"
      @confirm="$emit('confirm')"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'

@Component({
  components: { ConfirmDialog },
  emits: ['confirm', 'cancel'],
})
export default class DrainNodeDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly row: TResourceRow | null

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get title(): string {
    return `Drain node ${this.row?.name ?? ''}`.trim()
  }

  public get description(): string {
    return `${this.row?.name ?? 'This node'} is cordoned first, then every pod on it is evicted `
        + 'except mirror pods, DaemonSet pods and pods that have already finished. '
        + 'Evicted pods restart elsewhere, so their workloads are interrupted. '
        + 'A PodDisruptionBudget can refuse an eviction and leave the node partly drained.'
  }
}
</script>
