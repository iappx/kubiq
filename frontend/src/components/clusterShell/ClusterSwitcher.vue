<template>
  <ui-dropdown-menu :items="items" align="start" @select="onSelect">
    <template #trigger>
      <button
          :aria-label="`Active cluster: ${label}. Switch cluster`"
          :title="`Active cluster: ${label}`"
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
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { ChevronDown, UiDropdownMenu, UiStatusDot },
  emits: ['switch', 'catalog'],
})
export default class ClusterSwitcher extends VueBase {
  public static readonly catalogKey: string = 'catalog'

  @Prop({ required: true })
  public readonly connections: TClusterConnection[]

  @Prop({ required: false, default: '' })
  public readonly clusterId?: string

  public get active(): TClusterConnection | null {
    return this.connections.find(connection => connection.clusterId === this.clusterId) ?? null
  }

  public get label(): string {
    return this.active?.contextName ?? 'No cluster'
  }

  public get tone(): TUiTone {
    return this.active ? 'ok' : 'unknown'
  }

  public get items(): TUiMenuItem[] {
    const open = this.connections.map(connection => ({
      key: connection.clusterId,
      label: connection.contextName,
    }))

    return [
      ...open,
      { key: ClusterSwitcher.catalogKey, label: 'Cluster catalog', separatorBefore: open.length > 0 },
    ]
  }

  public onSelect(key: string): void {
    if (key === ClusterSwitcher.catalogKey) {
      this.$emit('catalog')
      return
    }

    this.$emit('switch', key)
  }
}
</script>
