<template>
  <section aria-label="Pinned clusters" class="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">
    <pin :size="14" aria-hidden="true" class="shrink-0 text-muted-foreground" />

    <cluster-pinned-card
        v-for="(row, index) in rows"
        :key="row.clusterId"
        :index="index"
        :row="row"
        @enter="$emit('enter', $event)"
        @unpin="$emit('unpin', $event)"
    />
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Pin } from '@lucide/vue'
import ClusterPinnedCard from '@/components/cluster/ClusterPinnedCard.vue'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'

@Component({
  components: { ClusterPinnedCard, Pin },
  emits: ['enter', 'unpin'],
})
export default class ClusterPinnedStrip extends VueBase {
  @Prop({ required: true })
  public readonly rows: TClusterRow[]
}
</script>
