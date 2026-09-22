<template>
  <ui-data-table
      :actions="actions"
      :busy-keys="busyKeys"
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
      row-key="key"
      @action="$emit('action', $event)"
      @open="$emit('open', $event)"
      @update:cursor="$emit('update:cursor', $event)"
      @update:sort="$emit('update:sort', $event)"
  >
    <template #cell-syncText="{ row }">
      <ui-status-badge :label="row.syncText" :tone="syncTone(row)" />
    </template>

    <template #cell-healthText="{ row }">
      <span class="inline-flex items-center gap-1.5 min-w-0">
        <ui-status-badge :label="row.healthText" :tone="healthTone(row)" />
        <loader-circle
            v-if="row.isOperationRunning"
            :size="12"
            :title="`${row.operationPhase} operation`"
            class="animate-spin text-muted-foreground shrink-0"
        />
      </span>
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
import { LoaderCircle } from '@lucide/vue'
import UiAge from '@/components/common/time/UiAge.vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ArgoToneMap } from '@/components/argocd/ArgoToneMap'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { LoaderCircle, UiAge, UiDataTable, UiStatusBadge },
  emits: ['open', 'action', 'update:sort', 'update:cursor'],
})
export default class ArgoApplicationTable extends VueBase {
  @Prop({ required: true })
  public readonly rows: TArgoApplicationRow[]

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

  @Prop({ required: false, default: () => [] })
  public readonly busyKeys?: string[]

  @Prop({ required: false, default: null })
  public readonly sort?: TUiTableSort | null

  @Prop({ required: false, default: null })
  public readonly cursor?: string | null

  @Prop({ required: false, default: false })
  public readonly refreshing?: boolean

  public syncTone(row: TArgoApplicationRow): TUiTone {
    return ArgoToneMap.ofSync(row.syncStatus)
  }

  public healthTone(row: TArgoApplicationRow): TUiTone {
    return ArgoToneMap.ofHealth(row.healthStatus)
  }

  // The tint a changed row leaves behind follows health, not sync: drift is expected, a
  // degraded application is not.
  public toneOf(row: TArgoApplicationRow): TUiTone {
    return ArgoToneMap.ofHealth(row.healthStatus)
  }
}
</script>
