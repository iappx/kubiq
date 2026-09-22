<template>
  <ui-dropdown-menu :items="items" align="start" @select="onSelect">
    <template #trigger>
      <button
          :aria-label="`Active cluster: ${label}. Switch cluster`"
          :title="title"
          class="ui-switcher"
          type="button"
      >
        <ui-status-dot :size="8" :tone="tone" />
        <span class="truncate max-w-48">{{ label }}</span>
        <chevron-down :size="14" aria-hidden="true" class="opacity-50 shrink-0" />
      </button>
    </template>
  </ui-dropdown-menu>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown } from '@lucide/vue'
import UiDropdownMenu from '@/components/common/menu/UiDropdownMenu.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import { ClusterSwitchOptions } from '@/components/clusterShell/ClusterSwitchOptions'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { ChevronDown, UiDropdownMenu, UiStatusDot },
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
    const name = this.active?.name ?? this.clusterId ?? ''

    return name === '' ? 'No cluster' : name
  }

  public get title(): string {
    return this.active === null
        ? `Active cluster: ${this.label}`
        : `Active cluster: ${this.label} — ${this.active.statusTitle}`
  }

  public get tone(): TUiTone {
    return this.active === null ? 'unknown' : ClusterToneMap.of(this.active.status)
  }

  public get items(): TUiMenuItem[] {
    return ClusterSwitchOptions.build(this.rows)
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
