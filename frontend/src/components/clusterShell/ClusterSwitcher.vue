<template>
  <ui-popover v-model:open="isOpen" align="start" label="Switch cluster">
    <template #trigger>
      <button
          :aria-label="`Active cluster: ${label}. Switch cluster`"
          :title="title"
          class="ui-switcher"
          type="button"
      >
        <cluster-status-avatar :icon="icon" :tone="tone" />
        <span class="truncate max-w-48">{{ label }}</span>
        <chevron-down :size="14" aria-hidden="true" class="opacity-50 shrink-0" />
      </button>
    </template>

    <div class="w-80 max-w-full flex flex-col max-h-96">
      <div v-if="groups.length > 0" class="min-h-0 flex-1 overflow-y-auto">
        <section
            v-for="(group, groupIndex) in groups"
            :key="group.key"
            :aria-label="group.title"
            :class="groupIndex > 0 ? 'border-t border-border' : ''"
        >
          <h3 class="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none">
            {{ group.title }}
          </h3>

          <ul class="p-1">
            <li
                v-for="row in group.rows"
                :key="row.clusterId"
                class="flex items-center gap-1"
            >
              <button
                  :aria-current="isCurrent(row) ? 'true' : undefined"
                  :title="hintOf(row)"
                  class="min-w-0 flex-1 flex items-center gap-2 rounded-sm px-2 min-h-7 text-left text-sm text-foreground hover:bg-muted"
                  type="button"
                  @click="selectCluster(row.clusterId)"
              >
                <cluster-status-avatar :icon="row.icon" :tone="toneOf(row)" />
                <span :class="['truncate', isCurrent(row) ? 'font-semibold text-primary' : '']">
                  {{ row.displayName }}
                </span>
                <ui-status-badge
                    v-if="isUnhealthy(row)"
                    :label="row.statusTitle"
                    :size="8"
                    :tone="toneOf(row)"
                    class="shrink-0 text-xs"
                />
              </button>

              <template v-if="row.isConnected">
                <button
                    :aria-label="`Reconnect to ${row.displayName}`"
                    class="btn-icon w-7 h-7 shrink-0"
                    title="Reconnect"
                    type="button"
                    @click="reconnectCluster(row.clusterId)"
                >
                  <refresh-cw :size="14" aria-hidden="true" />
                </button>

                <button
                    :aria-label="`Disconnect ${row.displayName}`"
                    class="btn-icon w-7 h-7 shrink-0"
                    title="Disconnect"
                    type="button"
                    @click="disconnectCluster(row.clusterId)"
                >
                  <unplug :size="14" aria-hidden="true" />
                </button>
              </template>
            </li>
          </ul>
        </section>
      </div>

      <div class="shrink-0 border-t border-border p-1">
        <button
            class="flex w-full items-center gap-2 rounded-sm px-2 min-h-7 text-left text-sm text-foreground hover:bg-muted"
            type="button"
            @click="openCatalog"
        >
          Cluster catalog
        </button>
      </div>
    </div>
  </ui-popover>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown, RefreshCw, Unplug } from '@lucide/vue'
import ClusterStatusAvatar from '@/components/cluster/ClusterStatusAvatar.vue'
import UiPopover from '@/components/common/popover/UiPopover.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ClusterChoices } from '@/components/cluster/ClusterChoices'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import { ClusterSwitchGroups } from '@/components/clusterShell/ClusterSwitchGroups'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TClusterSwitchGroup } from '@/components/clusterShell/types/TClusterSwitchGroup'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'

@Component({
  components: { ChevronDown, ClusterStatusAvatar, RefreshCw, UiPopover, UiStatusBadge, Unplug },
  emits: ['switch', 'catalog', 'reconnect', 'disconnect'],
})
export default class ClusterSwitcher extends VueBase {
  @Prop({ required: true })
  public readonly rows: TClusterRow[]

  @Prop({ required: false, default: '' })
  public readonly clusterId?: string

  public isOpen = false

  public get active(): TClusterRow | null {
    return this.rows.find(row => row.clusterId === this.clusterId) ?? null
  }

  // The route names a context the catalog may not have read yet, and that name is the cluster's.
  public get label(): string {
    const name = this.active?.displayName ?? this.clusterId ?? ''

    return name === '' ? 'No cluster' : name
  }

  public get icon(): TClusterIcon {
    return this.active?.icon ?? ClusterMonogram.iconFor(this.clusterId ?? '')
  }

  public get title(): string {
    if (this.active === null) {
      return `Active cluster: ${this.label}`
    }

    const context = this.active.displayName === this.active.name ? '' : ` (${this.active.name})`

    return `Active cluster: ${this.label}${context} — ${this.active.statusTitle}`
  }

  public get tone(): TUiTone {
    return this.active === null ? 'unknown' : ClusterToneMap.of(this.active.status)
  }

  public get groups(): TClusterSwitchGroup[] {
    return ClusterSwitchGroups.build(this.rows)
  }

  public toneOf(row: TClusterRow): TUiTone {
    return ClusterToneMap.of(row.status)
  }

  public isUnhealthy(row: TClusterRow): boolean {
    return ClusterSwitchGroups.isUnhealthy(row)
  }

  public isCurrent(row: TClusterRow): boolean {
    return row.clusterId === this.clusterId
  }

  public hintOf(row: TClusterRow): string {
    return ClusterChoices.hintOf(row)
  }

  public selectCluster(clusterId: string): void {
    this.isOpen = false
    this.$emit('switch', clusterId)
  }

  public reconnectCluster(clusterId: string): void {
    this.isOpen = false
    this.$emit('reconnect', clusterId)
  }

  public disconnectCluster(clusterId: string): void {
    this.isOpen = false
    this.$emit('disconnect', clusterId)
  }

  public openCatalog(): void {
    this.isOpen = false
    this.$emit('catalog')
  }
}
</script>
