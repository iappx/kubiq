<template>
  <ui-data-table
      :actions="actions"
      :busy-keys="busyKeys"
      :columns="columns"
      :cursor="cursor"
      :density="density"
      :hidden-keys="hiddenKeys"
      :label="`Clusters, ${rows.length} of ${totalCount}`"
      :rows="rows"
      :sort="sort"
      class="flex-1"
      name-key="name"
      row-key="clusterId"
      @action="onAction"
      @open="$emit('open', $event)"
      @update:cursor="$emit('update:cursor', $event)"
      @update:sort="$emit('update:sort', $event)"
  >
    <template #cell-name="{ row }">
      <div class="flex items-center gap-1 min-w-0">
        <button
            :aria-label="row.isPinned ? `Unpin ${row.name}` : `Pin ${row.name}`"
            :aria-pressed="row.isPinned ? 'true' : 'false'"
            :class="['cluster-pin-toggle', row.isPinned ? 'cluster-pin-toggle-on' : '']"
            :title="row.isPinned ? `Unpin ${row.name}` : `Pin ${row.name}`"
            type="button"
            @click.stop="$emit('toggle-pin', row.clusterId)"
        >
          <pin :size="12" />
        </button>

        <button
            :title="openTitle(row)"
            class="ui-name-button ui-cell"
            type="button"
            @click.stop="$emit('open', row)"
        >
          {{ row.name }}
        </button>

        <span v-if="row.isCurrent" class="pill shrink-0">current</span>
      </div>
    </template>

    <template #cell-status="{ row }">
      <div class="flex items-center gap-2 min-w-0">
        <ui-status-badge :label="row.statusTitle" :tone="toneOf(row)" />
        <loader-circle
            v-if="row.status === 'connecting'"
            :size="12"
            aria-hidden="true"
            class="animate-spin shrink-0 text-muted-foreground"
        />
      </div>
    </template>

    <template #empty>
      <slot name="empty" />
    </template>
  </ui-data-table>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle, Pin } from '@lucide/vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ClusterCatalogActions } from '@/components/cluster/ClusterCatalogActions'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { LoaderCircle, Pin, UiDataTable, UiStatusBadge },
  emits: ['open', 'details', 'connect', 'disconnect', 'toggle-pin', 'delete', 'update:sort', 'update:cursor'],
})
export default class ClusterCatalogTable extends VueBase {
  @Prop({ required: true })
  public readonly rows: TClusterRow[]

  @Prop({ required: true })
  public readonly columns: TUiTableColumn[]

  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: false, default: () => [] })
  public readonly hiddenKeys?: string[]

  @Prop({ required: false, default: null })
  public readonly sort?: TUiTableSort | null

  @Prop({ required: false, default: null })
  public readonly cursor?: string | null

  @Prop({ required: false, default: () => [] })
  public readonly busyKeys?: string[]

  @Prop({ required: false, default: 0 })
  public readonly totalCount?: number

  public get actions(): TUiMenuItem[] {
    return ClusterCatalogActions.of(this.menuRow)
  }

  // One action list serves the whole table, and UiDataTable moves the cursor onto the row whose menu is opening.
  private get menuRow(): TClusterRow | null {
    return this.rows.find(row => row.clusterId === this.cursor) ?? null
  }

  public toneOf(row: TClusterRow): TUiTone {
    return ClusterToneMap.of(row.status)
  }

  public openTitle(row: TClusterRow): string {
    return row.status === 'unsupported' ? `View details for ${row.name}` : `Open ${row.name}`
  }

  public onAction(event: { action: string; row: TClusterRow }): void {
    switch (event.action) {
      case ClusterCatalogActions.enterKey:
        this.$emit('open', event.row)
        return
      case ClusterCatalogActions.detailsKey:
        this.$emit('details', event.row)
        return
      case ClusterCatalogActions.connectKey:
        this.$emit('connect', event.row.clusterId)
        return
      case ClusterCatalogActions.disconnectKey:
        this.$emit('disconnect', event.row.clusterId)
        return
      case ClusterCatalogActions.pinKey:
        this.$emit('toggle-pin', event.row.clusterId)
        return
      case ClusterCatalogActions.deleteKey:
        this.$emit('delete', event.row)
    }
  }
}
</script>
