<template>
  <span class="relative inline-flex shrink-0">
    <cluster-avatar :icon="icon" :size="size" />
    <span class="cluster-avatar-status">
      <ui-status-dot :label="statusLabel" :size="size === 'lg' ? 10 : 8" :tone="tone" />
    </span>
  </span>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ClusterAvatar from '@/components/cluster/ClusterAvatar.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TClusterAvatarSize } from '@/components/cluster/types/TClusterAvatarSize'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'

@Component({
  components: { ClusterAvatar, UiStatusDot },
})
export default class ClusterStatusAvatar extends VueBase {
  @Prop({ required: true })
  public readonly icon: TClusterIcon

  @Prop({ required: true })
  public readonly tone: TUiTone

  @Prop({ required: false, default: 'sm' })
  public readonly size?: TClusterAvatarSize

  @Prop({ required: false })
  public readonly statusLabel?: string
}
</script>
