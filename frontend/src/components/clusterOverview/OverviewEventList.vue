<template>
  <ui-section description="Warnings the cluster raised most recently" title="Recent warnings">
    <template #actions>
      <router-link v-if="path" :to="path" class="text-xs text-primary hover:underline">Open Events</router-link>
    </template>

    <p v-if="error" class="text-sm text-muted-foreground">{{ error }}</p>

    <p v-else-if="events.length === 0" class="text-sm text-muted-foreground">
      No warnings in the selected scope. That is the state you want.
    </p>

    <ul v-else class="divide-y divide-border">
      <overview-event-row v-for="event in events" :key="event.key" :event="event" />
    </ul>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import OverviewEventRow from '@/components/clusterOverview/OverviewEventRow.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'

@Component({
  components: { OverviewEventRow, UiSection },
})
export default class OverviewEventList extends VueBase {
  @Prop({ required: true })
  public readonly events: TClusterEvent[]

  @Prop({ required: false, default: '' })
  public readonly path?: string

  @Prop({ required: false, default: '' })
  public readonly error?: string
}
</script>
