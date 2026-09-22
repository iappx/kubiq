<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <div class="ui-toolbar">
        <div class="flex items-baseline gap-2 min-w-0">
          <h2 class="text-sm font-semibold text-foreground truncate">Application sets</h2>
          <span class="text-xs text-muted-foreground tabular shrink-0">{{ rows.length }}</span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <button
              :disabled="store.loading"
              aria-label="Reload the application sets"
              class="btn-icon w-7 h-7"
              title="Reload the application sets"
              type="button"
              @click="store.load()"
          >
            <refresh-cw :class="store.loading ? 'animate-spin' : ''" :size="14" />
          </button>
        </div>
      </div>

      <ui-error-state
          v-if="store.error"
          :detail="store.errorDetail"
          :message="store.error"
          title="Could not list the application sets"
          @retry="store.load()"
      />

      <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
        <template #loading>
          <ui-skeletons :columns="6" :count="6" :density="density" type="table" />
        </template>
      </ui-deferred-loader>

      <ui-data-table
          v-else
          :columns="columns"
          :cursor="cursor"
          :density="density"
          :hidden-keys="hiddenKeys"
          :refreshing="store.loading"
          :rows="rows"
          :sort="sort"
          :tone-of="toneOf"
          class="flex-1"
          label="Argo CD application sets"
          name-key="name"
          row-key="key"
          @open="store.openSet($event.key)"
          @update:cursor="cursor = $event"
          @update:sort="sort = $event"
      >
        <template #cell-statusText="{ row }">
          <ui-status-badge :label="row.statusText" :tone="row.tone" />
        </template>

        <template #cell-createdAt="{ row }">
          <ui-age :value="row.createdAt" />
        </template>

        <template #empty>
          <empty-state
              :icon="emptyIcon"
              description="Nothing in this cluster generates applications from a template yet."
              title="No application sets"
          />
        </template>
      </ui-data-table>
    </div>

    <argo-application-set-detail-panel
        :application-set="store.selectedSet"
        :width="width"
        @close="store.closeSet()"
        @update:width="$emit('update:width', $event)"
    />
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Boxes, RefreshCw } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiAge from '@/components/common/time/UiAge.vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import ArgoApplicationSetDetailPanel from '@/components/argocd/ArgoApplicationSetDetailPanel.vue'
import { ArgoApplicationSetColumns } from '@/components/argocd/ArgoApplicationSetColumns'
import { ArgoApplicationSetRowBuilder } from '@/components/argocd/ArgoApplicationSetRowBuilder'
import type { TArgoApplicationSetRow } from '@/components/argocd/types/TArgoApplicationSetRow'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { ArgoProjectStore } from '@/store/modules/argocd/ArgoProjectStore'

@Component({
  components: {
    ArgoApplicationSetDetailPanel,
    EmptyState,
    RefreshCw,
    UiAge,
    UiDataTable,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
    UiStatusBadge,
  },
  emits: ['update:width'],
})
export default class ArgoApplicationSetsSection extends VueBase {
  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: true })
  public readonly width: number

  public hiddenKeys: string[] = ArgoApplicationSetColumns.hiddenByDefault()

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  constructor(
      @inject(ArgoProjectStore) public readonly store: ArgoProjectStore,
  ) {
    super()
  }

  public get rows(): TArgoApplicationSetRow[] {
    return ArgoApplicationSetRowBuilder.build(this.store.applicationSets)
  }

  public get columns(): TUiTableColumn[] {
    return ArgoApplicationSetColumns.all()
  }

  public get showSkeleton(): boolean {
    return this.store.loading && this.store.applicationSets.length === 0
  }

  public get emptyIcon(): VueComponent {
    return Boxes
  }

  public toneOf(row: TArgoApplicationSetRow): TUiTone {
    return row.tone
  }
}
</script>
