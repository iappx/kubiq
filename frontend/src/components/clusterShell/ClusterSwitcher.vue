<template>
  <ui-dropdown-menu :items="items" align="start" @select="onSelect">
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

    <template #item-leading="{ item }">
      <cluster-status-avatar
          v-if="isCluster(item.key)"
          :icon="iconOf(item.key)"
          :tone="item.tone ?? 'unknown'"
      />
      <component :is="item.icon" v-else-if="item.icon" :size="14" aria-hidden="true" />
    </template>
  </ui-dropdown-menu>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown } from '@lucide/vue'
import ClusterStatusAvatar from '@/components/cluster/ClusterStatusAvatar.vue'
import UiDropdownMenu from '@/components/common/menu/UiDropdownMenu.vue'
import { ClusterSwitchOptions } from '@/components/clusterShell/ClusterSwitchOptions'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'

@Component({
  components: { ChevronDown, ClusterStatusAvatar, UiDropdownMenu },
  emits: ['switch', 'catalog'],
})
export default class ClusterSwitcher extends VueBase {
  @Prop({ required: true })
  public readonly rows: TClusterRow[]

  @Prop({ required: false, default: '' })
  public readonly clusterId?: string

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

  public get items(): TUiMenuItem[] {
    return ClusterSwitchOptions.build(this.rows)
  }

  public isCluster(key: string): boolean {
    return ClusterSwitchOptions.clusterIdOf(key) !== ''
  }

  public iconOf(key: string): TClusterIcon {
    const clusterId = ClusterSwitchOptions.clusterIdOf(key)

    return this.rows.find(row => row.clusterId === clusterId)?.icon ?? ClusterMonogram.iconFor(clusterId)
  }

  public onSelect(key: string): void {
    if (key === ClusterSwitchOptions.catalogKey) {
      this.$emit('catalog')
      return
    }

    this.$emit('switch', ClusterSwitchOptions.clusterIdOf(key))
  }
}
</script>
