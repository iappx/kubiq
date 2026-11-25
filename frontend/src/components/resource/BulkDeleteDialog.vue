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
export default class BulkDeleteDialog extends VueBase {
  private static readonly previewLimit: number = 5

  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  @Prop({ required: true })
  public readonly rows: TResourceRow[]

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get title(): string {
    const label = this.rows.length === 1
        ? (this.kind?.kind ?? 'object')
        : (this.kind?.title ?? 'objects')

    return `Delete ${this.rows.length} ${label}?`
  }

  public get description(): string {
    if (this.rows.length === 0) {
      return 'No objects are selected.'
    }

    const preview = this.rows
        .slice(0, BulkDeleteDialog.previewLimit)
        .map(row => (row.namespace ? `${row.namespace}/${row.name}` : row.name))
    const remaining = this.rows.length - preview.length
    const listed = remaining > 0
        ? `${preview.join(', ')} and ${remaining} more`
        : preview.join(', ')

    return `${listed} will be removed with propagation policy ${ResourceDeletePolicy.applied} — dependent objects go with them. This cannot be undone.`
  }
}
</script>
