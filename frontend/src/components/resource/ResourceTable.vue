<template>
  <ui-data-table
      :actions="actions"
      :busy-keys="busyKeys"
      :columns="columns"
      :cursor="cursor"
      :density="density"
      :flash-keys="flashKeys"
      :hidden-keys="hiddenKeys"
      :label="label"
      :label-of="labelOf"
      :name-key="nameKey"
      :refreshing="refreshing"
      :rows="rows"
      :selected="selected"
      :sort="sort"
      :tone-of="toneOf"
      class="flex-1 min-h-0"
      row-key="key"
      selectable
      @action="$emit('action', $event)"
      @open="$emit('open', $event)"
      @update:cursor="$emit('update:cursor', $event)"
      @update:selected="$emit('update:selected', $event)"
      @update:sort="$emit('update:sort', $event)"
  >
    <template #cell-state="{ row }">
      <ui-status-badge :label="row.statusTitle" :tone="row.tone" />
    </template>

    <template #cell-createdAt="{ row }">
      <ui-age :value="row.createdAt" />
    </template>

    <template #empty>
      <slot name="empty" />
    </template>
  </ui-data-table>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiAge from '@/components/common/time/UiAge.vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ResourceColumns } from '@/components/resource/ResourceColumns'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { UiAge, UiDataTable, UiStatusBadge },
  emits: ['open', 'action', 'update:sort', 'update:selected', 'update:cursor'],
})
export default class ResourceTable extends VueBase {
  @Prop({ required: true })
  public readonly rows: TResourceRow[]

  @Prop({ required: true })
  public readonly columns: TUiTableColumn[]

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: () => [] })
  public readonly hiddenKeys?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly actions?: TUiMenuItem[]

  @Prop({ required: false, default: () => [] })
  public readonly selected?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly busyKeys?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly flashKeys?: string[]

  @Prop({ required: false, default: null })
  public readonly sort?: TUiTableSort | null

  @Prop({ required: false, default: null })
  public readonly cursor?: string | null

  @Prop({ required: false, default: 'compact' })
  public readonly density?: TUiTableDensity

  @Prop({ required: false, default: false })
  public readonly refreshing?: boolean

  public get nameKey(): string {
    return ResourceColumns.nameKey
  }

  public get toneOf(): (row: TResourceRow) => TUiTone {
    return row => row.tone
  }

  // Names repeat across namespaces, so without the prefix two row checkboxes read identically.
  public get labelOf(): (row: TResourceRow) => string {
    return row => (row.namespace ? `${row.namespace}/${row.name}` : row.name)
  }
}
</script>
