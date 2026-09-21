<template>
  <li class="border-b border-border pb-2 last:border-b-0 last:pb-0">
    <div class="flex items-baseline gap-2 text-xs">
      <ui-status-dot :label="event.type" :tone="tone" class="translate-y-px shrink-0" />
      <span class="min-w-0 truncate font-medium text-foreground">{{ event.reason }}</span>
      <span v-if="event.count > 1" class="pill shrink-0 px-1.5 py-0">×{{ event.count }}</span>
      <ui-age :value="event.lastSeen" class="ml-auto shrink-0 text-muted-foreground tabular" />
    </div>

    <p class="mt-1 text-xs text-muted-foreground">{{ event.message }}</p>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiAge from '@/components/common/time/UiAge.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { EventEntity } from '@/domain/entities/cluster'
import { KubeObjectHealth } from '@/domain/entities/kube'

@Component({
  components: { UiAge, UiStatusDot },
})
export default class ResourceEventRow extends VueBase {
  @Prop({ required: true })
  public readonly event: EventEntity

  public get tone(): TUiTone {
    return KubeObjectHealth.stateOf(this.event)
  }
}
</script>
