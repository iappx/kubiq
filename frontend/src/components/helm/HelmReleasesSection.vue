<template>
  <div class="flex flex-1 min-w-0 min-h-0 flex-col">
    <div class="ui-toolbar">
      <div class="flex items-baseline gap-2 min-w-0">
        <h2 class="text-sm font-semibold text-foreground truncate">Releases</h2>
        <span class="text-xs text-muted-foreground tabular shrink-0">{{ rows.length }}</span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
            :aria-pressed="store.includeSuperseded"
            :class="['pill', store.includeSuperseded ? 'pill-active' : '']"
            type="button"
            @click="store.setIncludeSuperseded(!store.includeSuperseded)"
        >Superseded</button>

        <helm-namespace-select
            :model-value="store.namespace"
            :namespaces="namespaces"
            @update:model-value="store.setNamespace($event)"
        />

        <ui-search-field
            :model-value="store.search"
            placeholder="Filter releases by name"
            shortcut="/"
            @update:model-value="store.setSearch($event)"
        />

        <button
            :disabled="store.loading"
            aria-label="Reload the releases"
            class="btn-icon w-7 h-7"
            title="Reload the releases"
            type="button"
            @click="store.load()"
        >
          <refresh-cw :class="store.loading ? 'animate-spin' : ''" :size="14" />
        </button>

        <button class="btn-primary" type="button" @click="$emit('install')">
          <download :size="14" />
          Install chart
        </button>
      </div>
    </div>

    <ui-error-state
        v-if="store.error"
        :detail="store.errorDetail"
        :message="store.error"
        title="Could not list the releases"
        @retry="store.load()"
    />

    <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
      <template #loading>
        <ui-skeletons :columns="columns.length" :count="10" :density="density" type="table" />
      </template>
    </ui-deferred-loader>

    <helm-release-table
        v-else
        :actions="actions"
        :columns="columns"
        :cursor="cursor"
        :density="density"
        :hidden-keys="hiddenKeys"
        :refreshing="store.loading"
        :rows="rows"
        :sort="sort"
        label="Helm releases"
        @action="onAction"
        @open="open($event)"
        @update:cursor="cursor = $event"
        @update:sort="sort = $event"
    >
      <template #empty>
        <empty-state
            v-if="isFiltered"
            :icon="emptyIcon"
            :on-action="clearFilters"
            action-label="Clear filters"
            description="Superseded and uninstalled revisions are hidden unless you ask for them."
            title="No releases match these filters"
        />
        <empty-state
            v-else
            :icon="emptyIcon"
            :on-action="startInstall"
            action-label="Install chart"
            description="Nothing has been installed with Helm in this cluster yet."
            title="No Helm releases"
        />
      </template>
    </helm-release-table>

    <helm-release-detail-panel
        :active-tab="detailTab"
        :busy="busy"
        :row="selectedRow"
        :width="width"
        @close="store.close()"
        @uninstall="$emit('uninstall', selectedRow)"
        @update:active-tab="detailTab = $event"
        @update:width="$emit('update:width', $event)"
        @upgrade="$emit('upgrade', selectedRow)"
    >
      <helm-release-detail-body
          v-if="selectedRow"
          :key="store.selectedId"
          :busy="busy"
          :cluster-id="store.clusterId"
          :detail="store.detail"
          :error="store.detailError"
          :error-detail="store.detailErrorDetail"
          :loading="store.detailLoading"
          :row="selectedRow"
          :tab="detailTab"
          @retry="store.reopen()"
          @rollback="$emit('rollback', { row: selectedRow, revision: $event })"
      />
    </helm-release-detail-panel>
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Download, Package, RefreshCw } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import HelmNamespaceSelect from '@/components/helm/HelmNamespaceSelect.vue'
import HelmReleaseDetailPanel from '@/components/helm/HelmReleaseDetailPanel.vue'
import HelmReleaseDetailBody from '@/components/helm/detail/HelmReleaseDetailBody.vue'
import HelmReleaseTable from '@/components/helm/HelmReleaseTable.vue'
import { HelmDetailTabs } from '@/components/helm/detail/HelmDetailTabs'
import { HelmReleaseActions } from '@/components/helm/HelmReleaseActions'
import { HelmReleaseColumns } from '@/components/helm/HelmReleaseColumns'
import { HelmReleaseRowBuilder } from '@/components/helm/HelmReleaseRowBuilder'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import { HelmStore } from '@/store/modules/helm/HelmStore'

@Component({
  components: {
    Download,
    EmptyState,
    HelmNamespaceSelect,
    HelmReleaseDetailBody,
    HelmReleaseDetailPanel,
    HelmReleaseTable,
    RefreshCw,
    UiDeferredLoader,
    UiErrorState,
    UiSearchField,
    UiSkeletons,
  },
  emits: ['install', 'upgrade', 'uninstall', 'rollback', 'update:width'],
})
export default class HelmReleasesSection extends VueBase {
  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: () => [] })
  public readonly namespaces?: string[]

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public detailTab: string = HelmDetailTabs.overviewKey

  public hiddenKeys: string[] = []

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  constructor(
      @inject(HelmStore) public readonly store: HelmStore,
  ) {
    super()
  }

  public get rows(): THelmReleaseRow[] {
    return HelmReleaseRowBuilder.build(this.store.releases)
  }

  public get selectedRow(): THelmReleaseRow | null {
    return this.rows.find(row => row.id === this.store.selectedId) ?? null
  }

  public get columns(): TUiTableColumn[] {
    return HelmReleaseColumns.all()
  }

  public get actions(): TUiMenuItem[] {
    return HelmReleaseActions.all()
  }

  public get emptyIcon(): VueComponent {
    return Package
  }

  public get isFiltered(): boolean {
    return this.store.search !== '' || this.store.namespace !== ''
  }

  public get showSkeleton(): boolean {
    return this.store.loading && this.store.releases.length === 0
  }

  public startInstall(): void {
    this.$emit('install')
  }

  public clearFilters(): void {
    void this.store.clearFilters()
  }

  public open(row: THelmReleaseRow): void {
    this.detailTab = HelmDetailTabs.overviewKey
    const release = this.store.releases.find(candidate => candidate.id === row.id)
    if (release) {
      void this.store.open(release)
    }
  }

  public onAction(event: { action: string, row: THelmReleaseRow }): void {
    if (event.action === HelmReleaseActions.upgrade) {
      this.$emit('upgrade', event.row)
      return
    }
    if (event.action === HelmReleaseActions.uninstall) {
      this.$emit('uninstall', event.row)
      return
    }
    if (event.action === HelmReleaseActions.history) {
      this.open(event.row)
      this.detailTab = HelmDetailTabs.historyKey
    }
  }
}
</script>
