<template>
  <confirm-dialog
      :description="description"
      :loading="busy"
      :open="open"
      :title="title"
      confirm-label="Delete"
      variant="danger"
      @cancel="$emit('cancel')"
      @confirm="$emit('confirm')"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { ResourceDeletePolicy } from '@/application/services/resourceList/constants/ResourceDeletePolicy'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { KubeResourceKind } from '@/domain/models/kube'

@Component({
  components: { ConfirmDialog },
  emits: ['confirm', 'cancel'],
})
export default class DeleteResourceDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly row: TResourceRow | null

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get title(): string {
    return `Delete ${this.kind?.kind ?? 'object'} ${this.row?.name ?? ''}`.trim()
  }

  public get description(): string {
    const scope = this.row?.namespace
        ? `in namespace ${this.row.namespace}`
        : 'from the cluster'

    return `${this.kind?.kind ?? 'The object'} ${this.row?.name ?? ''} will be removed ${scope}, `
        + `with propagation policy ${ResourceDeletePolicy.applied} — dependent objects go with it. `
        + 'This cannot be undone.'
  }
}
</script>
