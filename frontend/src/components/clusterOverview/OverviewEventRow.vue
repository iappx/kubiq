<template>
  <li class="flex items-start gap-2 min-w-0 py-1">
    <ui-status-dot :size="8" :tone="event.state" class="mt-1.5 shrink-0" />

    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="text-sm font-medium text-foreground shrink-0">{{ event.reason }}</span>
        <span class="text-xs text-muted-foreground truncate">{{ event.object }}</span>
        <span v-if="event.namespace" class="text-xs text-muted-foreground shrink-0">· {{ event.namespace }}</span>
      </div>
      <p :title="event.message" class="text-xs text-muted-foreground truncate">{{ event.message }}</p>
    </div>

    <span v-if="event.count > 1" class="pill shrink-0 tabular">×{{ event.count }}</span>
    <ui-age :value="event.lastSeen" class="text-xs text-muted-foreground tabular shrink-0" />
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiAge from '@/components/common/time/UiAge.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'

@Component({
  components: { UiAge, UiStatusDot },
})
export default class OverviewEventRow extends VueBase {
  @Prop({ required: true })
  public readonly event: TClusterEvent
}
</script>
