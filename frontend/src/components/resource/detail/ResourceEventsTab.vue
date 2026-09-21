<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-muted-foreground">
        {{ state.events.length }} {{ state.events.length === 1 ? 'event' : 'events' }}
      </span>

      <ui-live-indicator :since="state.eventsStaleSince" :state="liveState" @reconnect="$emit('reconnect')" />
    </div>

    <ui-error-state
        v-if="state.eventsError"
        :message="state.eventsError"
        title="Could not read the events of this object"
        @retry="$emit('reconnect')"
    />

    <ui-deferred-loader v-else-if="!state.eventsLoaded" :loading="true">
      <template #loading>
        <ui-skeletons :count="4" type="rows" />
      </template>
    </ui-deferred-loader>

    <empty-state
        v-else-if="state.events.length === 0"
        :icon="emptyIcon"
        description="The cluster keeps events for about an hour; an object that is behaving has none."
        title="No events for this object"
    />

    <ul v-else class="space-y-2">
      <resource-event-row v-for="event in state.events" :key="keyOf(event)" :event="event" />
    </ul>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Bell } from '@lucide/vue'
import type { Component as VueComponent } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ResourceEventRow from '@/components/resource/detail/ResourceEventRow.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiLiveIndicator from '@/components/common/feedback/UiLiveIndicator.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import type { EventEntity } from '@/domain/entities/cluster'
import { KubeObjectKey } from '@/domain/entities/kube'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { EmptyState, ResourceEventRow, UiDeferredLoader, UiErrorState, UiLiveIndicator, UiSkeletons },
  emits: ['reconnect'],
})
export default class ResourceEventsTab extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  public get liveState(): 'live' | 'stale' | 'off' {
    if (this.state.eventsWatching) {
      return 'live'
    }

    return this.state.eventsStaleSince > 0 ? 'stale' : 'off'
  }

  public get emptyIcon(): VueComponent {
    return Bell
  }

  public keyOf(event: EventEntity): string {
    return KubeObjectKey.of(event)
  }
}
</script>
