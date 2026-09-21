<template>
  <ui-data-table
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
            :title="row.name"
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
      <ui-status-badge :label="row.statusTitle" :tone="toneOf(row)" />
    </template>

    <template #cell-action="{ row }">
      <button
          v-if="row.status === 'connected'"
          :aria-label="`Disconnect from ${row.name}`"
          :title="`Disconnect from ${row.name}`"
          class="btn-icon w-7 h-7"
          type="button"
          @click.stop="$emit('disconnect', row.clusterId)"
      >
        <unplug :size="14" />
      </button>
      <button
          v-else-if="row.status === 'connecting'"
          :aria-label="`Connecting to ${row.name}`"
          class="btn-icon w-7 h-7"
          disabled
          type="button"
      >
        <loader-circle :size="14" class="animate-spin" />
      </button>
      <button
          v-else-if="row.status !== 'unsupported'"
          :aria-label="`Connect to ${row.name}`"
          :title="`Connect to ${row.name}`"
          class="btn-icon w-7 h-7"
          type="button"
          @click.stop="$emit('connect', row.clusterId)"
      >
        <plug :size="14" />
      </button>
    </template>

    <template #empty>
      <slot name="empty" />
    </template>
  </ui-data-table>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle, Pin, Plug, Unplug } from '@lucide/vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { LoaderCircle, Pin, Plug, UiDataTable, UiStatusBadge, Unplug },
  emits: ['open', 'connect', 'disconnect', 'toggle-pin', 'update:sort', 'update:cursor'],
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

  public toneOf(row: TClusterRow): TUiTone {
    return ClusterToneMap.of(row.status)
  }
}
</script>
