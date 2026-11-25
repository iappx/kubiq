<template>
  <ui-section description="Warnings the cluster raised most recently" title="Recent warnings">
    <template #actions>
      <router-link v-if="path" :to="path" class="text-xs text-primary hover:underline">Open Events</router-link>
    </template>

    <p v-if="error" class="text-sm text-muted-foreground">{{ error }}</p>

    <p v-else-if="events.length === 0" class="text-sm text-muted-foreground">
      No warnings in the selected scope. That is the state you want.
    </p>

    <div v-else class="space-y-3">
      <div class="flex flex-wrap items-center gap-1">
        <button
            :class="['pill', activeReason === '' ? 'pill-active' : '']"
            type="button"
            @click="selectReason('')"
        >
          All
          <span class="ml-1 tabular">{{ totalOccurrences }}</span>
        </button>

        <button
            v-for="pill in reasonPills"
            :key="pill.reason"
            :class="['pill', activeReason === pill.reason ? 'pill-active' : '']"
            type="button"
            @click="toggleReason(pill.reason)"
        >
          {{ pill.reason }}
          <span class="ml-1 tabular">{{ pill.count }}</span>
        </button>
      </div>

      <div class="divide-y divide-border rounded-md border border-border">
        <div v-for="(group, index) in groups" :key="group.label">
          <button
              :aria-expanded="isExpanded(group.label, index)"
              class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
              type="button"
              @click="toggleGroup(group.label, index)"
          >
            <chevron-down v-if="isExpanded(group.label, index)" :size="14" class="text-muted-foreground shrink-0" />
            <chevron-right v-else :size="14" class="text-muted-foreground shrink-0" />
            <span class="text-xs font-medium text-foreground truncate">{{ group.label }}</span>
            <span class="ml-auto pill tabular">{{ group.events.length }}</span>
          </button>

          <ul v-if="isExpanded(group.label, index)" class="divide-y divide-border border-t border-border px-3">
            <overview-event-row v-for="event in group.events" :key="event.key" :event="event" />
          </ul>
        </div>
      </div>
    </div>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { OverviewEventGrouper } from '@/components/clusterOverview/OverviewEventGrouper'
import OverviewEventRow from '@/components/clusterOverview/OverviewEventRow.vue'
import type { TEventNamespaceGroup } from '@/components/clusterOverview/types/TEventNamespaceGroup'
import type { TEventReasonPill } from '@/components/clusterOverview/types/TEventReasonPill'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'

@Component({
  components: { ChevronDown, ChevronRight, OverviewEventRow, UiSection },
})
export default class OverviewEventList extends VueBase {
  public static readonly defaultOpenCount: number = 3

  @Prop({ required: true })
  public readonly events: TClusterEvent[]

  @Prop({ required: false, default: '' })
  public readonly path?: string

  @Prop({ required: false, default: '' })
  public readonly error?: string

  public activeReason: string = ''

  public toggled: Record<string, boolean> = {}

  public get reasonPills(): TEventReasonPill[] {
    return OverviewEventGrouper.reasons(this.events)
  }

  public get totalOccurrences(): number {
    return this.reasonPills.reduce((sum, pill) => sum + pill.count, 0)
  }

  public get groups(): TEventNamespaceGroup[] {
    return OverviewEventGrouper.group(this.events, this.activeReason)
  }

  public selectReason(reason: string): void {
    this.activeReason = reason
  }

  public toggleReason(reason: string): void {
    this.activeReason = this.activeReason === reason ? '' : reason
  }

  public isExpanded(label: string, index: number): boolean {
    if (Object.prototype.hasOwnProperty.call(this.toggled, label)) {
      return this.toggled[label]
    }

    return this.activeReason !== '' || index < OverviewEventList.defaultOpenCount
  }

  public toggleGroup(label: string, index: number): void {
    this.toggled = { ...this.toggled, [label]: !this.isExpanded(label, index) }
  }
}
</script>
