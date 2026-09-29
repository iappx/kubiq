<template>
  <motion-div
      :animate="{ opacity: 1, y: 0 }"
      :initial="{ opacity: 0, y: 4 }"
      :transition="{ duration: normal, delay, ease: easeOut }"
      class="relative"
  >
    <button
        :aria-current="row.isActive ? 'true' : undefined"
        :class="['cluster-pin', row.isActive ? 'cluster-pin-active' : '']"
        :title="`Open ${row.displayName} — ${row.statusTitle}`"
        type="button"
        @click="$emit('enter', row)"
    >
      <cluster-status-avatar :icon="row.icon" :status-label="row.statusTitle" :tone="tone" />
      <span class="truncate">{{ row.displayName }}</span>
    </button>

    <button
        :aria-label="`Unpin ${row.displayName}`"
        :title="`Unpin ${row.displayName}`"
        class="cluster-pin-remove"
        type="button"
        @click="$emit('unpin', row.clusterId)"
    >
      <x :size="10" />
    </button>
  </motion-div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { motion } from 'motion-v'
import { X } from '@lucide/vue'
import ClusterStatusAvatar from '@/components/cluster/ClusterStatusAvatar.vue'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import { UiMotion } from '@/constants/UiMotion'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { ClusterStatusAvatar, MotionDiv: motion.div, X },
  emits: ['enter', 'unpin'],
})
export default class ClusterPinnedCard extends VueBase {
  @Prop({ required: true })
  public readonly row: TClusterRow

  @Prop({ required: false, default: 0 })
  public readonly index?: number

  public get tone(): TUiTone {
    return ClusterToneMap.of(this.row.status)
  }

  public get delay(): number {
    return UiMotion.stagger(this.index ?? 0)
  }

  public get normal(): number {
    return UiMotion.normal
  }

  public get easeOut(): [number, number, number, number] {
    return UiMotion.easeOut
  }
}
</script>
