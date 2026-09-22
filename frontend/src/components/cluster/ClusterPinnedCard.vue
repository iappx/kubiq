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
        :title="`Open ${row.name} — ${row.statusTitle}`"
        type="button"
        @click="$emit('enter', row)"
    >
      <ui-status-dot :label="row.statusTitle" :tone="tone" />
      <span class="truncate">{{ row.name }}</span>
    </button>

    <button
        :aria-label="`Unpin ${row.name}`"
        :title="`Unpin ${row.name}`"
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
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import { UiMotion } from '@/constants/UiMotion'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { MotionDiv: motion.div, UiStatusDot, X },
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
