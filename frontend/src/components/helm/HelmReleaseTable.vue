<template>
  <ui-data-table
      :actions="actions"
      :columns="columns"
      :cursor="cursor"
      :density="density"
      :hidden-keys="hiddenKeys"
      :label="label"
      :refreshing="refreshing"
      :rows="rows"
      :sort="sort"
      :tone-of="toneOf"
      class="flex-1"
      name-key="name"
      row-key="id"
      @action="$emit('action', $event)"
      @open="$emit('open', $event)"
      @update:cursor="$emit('update:cursor', $event)"
      @update:sort="$emit('update:sort', $event)"
  >
    <template #cell-statusText="{ row }">
      <ui-status-badge :label="row.statusText" :tone="toneOf(row)" />
    </template>

    <template #cell-updated="{ row }">
      <ui-age :value="row.updated" />
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
import { HelmToneMap } from '@/components/helm/HelmToneMap'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { UiAge, UiDataTable, UiStatusBadge },
  emits: ['open', 'action', 'update:sort', 'update:cursor'],
})
export default class HelmReleaseTable extends VueBase {
  @Prop({ required: true })
  public readonly rows: THelmReleaseRow[]

  @Prop({ required: true })
  public readonly columns: TUiTableColumn[]

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: false, default: () => [] })
  public readonly actions?: TUiMenuItem[]

  @Prop({ required: false, default: () => [] })
  public readonly hiddenKeys?: string[]

  @Prop({ required: false, default: null })
  public readonly sort?: TUiTableSort | null

  @Prop({ required: false, default: null })
  public readonly cursor?: string | null

  @Prop({ required: false, default: false })
  public readonly refreshing?: boolean

  public toneOf(row: THelmReleaseRow): TUiTone {
    return HelmToneMap.ofRelease(row.status)
  }
}
</script>
