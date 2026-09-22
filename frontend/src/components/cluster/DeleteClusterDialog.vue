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
import { ClusterDeletionCopy } from '@/components/cluster/ClusterDeletionCopy'
import type { TKubeconfigDeletion } from '@/store/modules/clusterCatalog/types/TKubeconfigDeletion'

@Component({
  components: { ConfirmDialog },
  emits: ['confirm', 'cancel'],
})
export default class DeleteClusterDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly target: TKubeconfigDeletion | null

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get title(): string {
    return ClusterDeletionCopy.titleOf(this.target)
  }

  public get description(): string {
    return ClusterDeletionCopy.descriptionOf(this.target)
  }
}
</script>
