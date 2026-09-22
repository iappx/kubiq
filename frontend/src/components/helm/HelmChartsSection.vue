<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <div class="ui-toolbar">
        <div class="flex items-baseline gap-2 min-w-0">
          <h2 class="text-sm font-semibold text-foreground truncate">Charts</h2>
          <span class="text-xs text-muted-foreground tabular shrink-0">{{ rows.length }}</span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <button
              :aria-pressed="store.allVersions"
              :class="['pill', store.allVersions ? 'pill-active' : '']"
              type="button"
              @click="store.setAllVersions(!store.allVersions)"
          >All versions</button>

          <ui-search-field
              :model-value="store.keyword"
              placeholder="Search charts by name or description"
              shortcut="/"
              @update:model-value="store.setKeyword($event)"
          />
        </div>
      </div>

      <div class="px-4 pb-2">
        <helm-repository-filter
            :names="store.repositoryNames"
            :selected="store.repoFilter"
            @select="store.setRepoFilter($event)"
        />
      </div>

      <ui-error-state
          v-if="store.chartsError"
          :detail="store.chartsErrorDetail"
          :message="store.chartsError"
          title="Could not search the repositories"
          @retry="store.search()"
      />

      <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
        <template #loading>
          <ui-skeletons :columns="4" :count="8" :density="density" type="table" />
        </template>
      </ui-deferred-loader>

      <ui-data-table
          v-else
          :columns="columns"
          :density="density"
          :refreshing="store.chartsLoading"
          :rows="rows"
          class="flex-1"
          label="Charts"
          name-key="ref"
          row-key="id"
          @open="open($event)"
      >
        <template #empty>
          <empty-state
              v-if="store.repositoryNames.length === 0"
              :icon="emptyIcon"
              description="Charts come from repositories. Add one on the Repositories tab first."
              title="No chart repositories"
          />
          <empty-state
              v-else-if="isFiltered"
              :icon="emptyIcon"
              :on-action="clear"
              :title="`No charts match \`${store.keyword}\``"
              action-label="Clear search"
              description="helm search repo matches the chart name and its description in the repository indexes you have."
          />
          <empty-state
              v-else
              :icon="emptyIcon"
              description="Run Update on the Repositories tab if the index looks out of date."
              title="No charts in these repositories"
          />
        </template>
      </ui-data-table>
    </div>

    <helm-chart-detail-panel
        :active-tab="detailTab"
        :chart="selectedRow"
        :detail="store.chartDetail"
        :error="store.chartDetailError"
        :loading="store.chartDetailLoading"
        :width="width"
        @close="store.closeChart()"
        @install="$emit('install', selectedRow)"
        @update:active-tab="detailTab = $event"
        @update:width="$emit('update:width', $event)"
    />
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Package } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import HelmChartDetailPanel from '@/components/helm/HelmChartDetailPanel.vue'
import HelmRepositoryFilter from '@/components/helm/HelmRepositoryFilter.vue'
import type { THelmChartRow } from '@/components/helm/types/THelmChartRow'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import { HelmRepositoryStore } from '@/store/modules/helm/HelmRepositoryStore'

@Component({
  components: {
    EmptyState,
    HelmChartDetailPanel,
    HelmRepositoryFilter,
    UiDataTable,
    UiDeferredLoader,
    UiErrorState,
    UiSearchField,
    UiSkeletons,
  },
  emits: ['install', 'update:width'],
})
export default class HelmChartsSection extends VueBase {
  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: true })
  public readonly width: number

  public detailTab: string = HelmChartDetailPanel.readmeKey

  constructor(
      @inject(HelmRepositoryStore) public readonly store: HelmRepositoryStore,
  ) {
    super()
  }

  public get rows(): THelmChartRow[] {
    return this.store.charts.map(chart => ({
      id: chart.id,
      ref: chart.ref,
      repoName: chart.repoName,
      chartName: chart.chartName,
      version: chart.version,
      appVersion: chart.appVersion,
      description: chart.description,
    }))
  }

  public get selectedRow(): THelmChartRow | null {
    return this.rows.find(row => row.id === this.store.selectedChartId) ?? null
  }

  public get columns(): TUiTableColumn[] {
    return [
      { key: 'ref', title: 'Chart', locked: true },
      { key: 'version', title: 'Version' },
      { key: 'appVersion', title: 'App version' },
      { key: 'description', title: 'Description', sortable: false },
    ]
  }

  public get emptyIcon(): VueComponent {
    return Package
  }

  public get isFiltered(): boolean {
    return this.store.keyword !== '' || this.store.repoFilter !== ''
  }

  public get showSkeleton(): boolean {
    return this.store.chartsLoading && this.store.charts.length === 0
  }

  public clear(): void {
    void this.store.setKeyword('')
  }

  public open(row: THelmChartRow): void {
    this.detailTab = HelmChartDetailPanel.readmeKey
    const chart = this.store.charts.find(candidate => candidate.id === row.id)
    if (chart) {
      void this.store.openChart(chart)
    }
  }
}
</script>
