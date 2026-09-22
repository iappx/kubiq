<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <div class="ui-toolbar flex-wrap">
        <div class="flex items-baseline gap-2 min-w-0">
          <h2 class="text-sm font-semibold text-foreground truncate">Applications</h2>
          <span class="text-xs text-muted-foreground tabular shrink-0">{{ countText }}</span>
        </div>

        <argo-status-filter
            :active="store.syncFilter"
            :options="syncOptions"
            label="Sync"
            @change="store.setSyncFilter($event)"
        />

        <argo-status-filter
            :active="store.healthFilter"
            :options="healthOptions"
            label="Health"
            @change="store.setHealthFilter($event)"
        />

        <div class="ml-auto flex items-center gap-2">
          <ui-search-field
              :model-value="store.search"
              placeholder="Filter applications by name, project or destination"
              shortcut="/"
              @update:model-value="store.setSearch($event)"
          />

          <button
              :disabled="store.loading"
              aria-label="Reload the applications"
              class="btn-icon w-7 h-7"
              title="Reload the applications"
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
          title="Could not list the applications"
          @retry="store.load()"
      />

      <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
        <template #loading>
          <ui-skeletons :columns="7" :count="10" :density="density" type="table" />
        </template>
      </ui-deferred-loader>

      <argo-application-table
          v-else
          :actions="actions"
          :busy-keys="store.busyKeys"
          :columns="columns"
          :cursor="cursor"
          :density="density"
          :hidden-keys="hiddenKeys"
          :refreshing="store.loading"
          :rows="rows"
          :sort="sort"
          label="Argo CD applications"
          @action="onAction($event)"
          @open="open($event)"
          @update:cursor="cursor = $event"
          @update:sort="sort = $event"
      >
        <template #empty>
          <empty-state
              v-if="store.hasFilters"
              :icon="emptyIcon"
              :on-action="clearFilters"
              :title="noMatchTitle"
              action-label="Clear filters"
              description="Sync and health filters narrow the list as well as the search field."
          />
          <empty-state
              v-else
              :icon="emptyIcon"
              description="Argo CD is installed here, but it manages no application yet."
              title="No Argo CD applications"
          />
        </template>
      </argo-application-table>
    </div>

    <argo-application-detail-panel
        :active-tab="detailTab"
        :busy="busy"
        :can-delete="store.canDelete"
        :can-sync="store.canSync"
        :row="selectedRow"
        :width="width"
        @close="store.close()"
        @refresh="refresh(false)"
        @remove="$emit('remove', selectedRow)"
        @sync="$emit('sync', { row: selectedRow, revision: '' })"
        @terminate="terminate"
        @update:active-tab="detailTab = $event"
        @update:width="$emit('update:width', $event)"
    >
      <argo-application-detail-body
          v-if="store.selected && selectedRow"
          :key="store.selectedKey"
          :application="store.selected"
          :busy="busy"
          :can-sync="store.canSync"
          :cluster-id="store.clusterId"
          :tab="detailTab"
          @automated="setAutomated($event)"
          @rollback="$emit('sync', { row: selectedRow, revision: $event })"
      />
    </argo-application-detail-panel>
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { RefreshCw, Rocket } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import ArgoApplicationDetailPanel from '@/components/argocd/ArgoApplicationDetailPanel.vue'
import ArgoApplicationDetailBody from '@/components/argocd/detail/ArgoApplicationDetailBody.vue'
import ArgoApplicationTable from '@/components/argocd/ArgoApplicationTable.vue'
import ArgoStatusFilter from '@/components/argocd/ArgoStatusFilter.vue'
import { ArgoApplicationActions } from '@/components/argocd/ArgoApplicationActions'
import { ArgoApplicationColumns } from '@/components/argocd/ArgoApplicationColumns'
import { ArgoApplicationFilter } from '@/components/argocd/ArgoApplicationFilter'
import { ArgoApplicationRowBuilder } from '@/components/argocd/ArgoApplicationRowBuilder'
import { ArgoStatusOptions } from '@/components/argocd/ArgoStatusOptions'
import { ArgoDetailTabs } from '@/components/argocd/detail/ArgoDetailTabs'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import type { TArgoStatusOption } from '@/components/argocd/types/TArgoStatusOption'
import type { TArgoAutomatedSyncPolicy } from '@/domain/entities/argocd/types/TArgoAutomatedSyncPolicy'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import { ArgoStore } from '@/store/modules/argocd/ArgoStore'

@Component({
  components: {
    ArgoApplicationDetailBody,
    ArgoApplicationDetailPanel,
    ArgoApplicationTable,
    ArgoStatusFilter,
    EmptyState,
    RefreshCw,
    UiDeferredLoader,
    UiErrorState,
    UiSearchField,
    UiSkeletons,
  },
  emits: ['sync', 'remove', 'update:width'],
})
export default class ArgoApplicationsSection extends VueBase {
  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: true })
  public readonly width: number

  public detailTab: string = ArgoDetailTabs.overviewKey

  public hiddenKeys: string[] = ArgoApplicationColumns.hiddenByDefault()

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  constructor(
      @inject(ArgoStore) public readonly store: ArgoStore,
  ) {
    super()
  }

  public get allRows(): TArgoApplicationRow[] {
    return ArgoApplicationRowBuilder.build(this.store.applications)
  }

  public get rows(): TArgoApplicationRow[] {
    return ArgoApplicationFilter.apply(
        this.allRows,
        this.store.search,
        this.store.syncFilter,
        this.store.healthFilter,
    )
  }

  public get selectedRow(): TArgoApplicationRow | null {
    return this.allRows.find(row => row.key === this.store.selectedKey) ?? null
  }

  public get columns(): TUiTableColumn[] {
    return ArgoApplicationColumns.all()
  }

  public get syncOptions(): TArgoStatusOption[] {
    return ArgoStatusOptions.sync(this.allRows)
  }

  public get healthOptions(): TArgoStatusOption[] {
    return ArgoStatusOptions.health(this.allRows)
  }

  public get actions(): TUiMenuItem[] {
    return ArgoApplicationActions.forCapabilities(this.store.canSync, this.store.canDelete)
  }

  public get busy(): boolean {
    return this.store.isBusy
  }

  public get countText(): string {
    return this.rows.length === this.allRows.length
        ? String(this.allRows.length)
        : `${this.rows.length} of ${this.allRows.length}`
  }

  public get showSkeleton(): boolean {
    return this.store.loading && this.store.applications.length === 0
  }

  public get emptyIcon(): VueComponent {
    return Rocket
  }

  public get noMatchTitle(): string {
    return this.store.search === ''
        ? 'No applications match these filters'
        : `No applications match "${this.store.search}"`
  }

  public clearFilters(): void {
    this.store.clearFilters()
  }

  public open(row: TArgoApplicationRow): void {
    this.detailTab = ArgoDetailTabs.overviewKey
    this.store.open(row.key)
  }

  public onAction(event: { action: string, row: TArgoApplicationRow }): void {
    if (event.action === ArgoApplicationActions.sync) {
      this.$emit('sync', { row: event.row, revision: '' })
      return
    }
    if (event.action === ArgoApplicationActions.remove) {
      this.$emit('remove', event.row)
      return
    }
    if (event.action === ArgoApplicationActions.history) {
      this.store.open(event.row.key)
      this.detailTab = ArgoDetailTabs.historyKey
      return
    }

    void this.runDirect(event.action, event.row)
  }

  public refresh(hard: boolean): void {
    const application = this.store.selected
    if (application) {
      void this.store.refresh(application, hard)
    }
  }

  public terminate(): void {
    const application = this.store.selected
    if (application) {
      void this.store.terminate(application)
    }
  }

  public setAutomated(automated: TArgoAutomatedSyncPolicy | null): void {
    const application = this.store.selected
    if (application) {
      void this.store.setAutomatedSync(application, automated)
    }
  }

  private async runDirect(action: string, row: TArgoApplicationRow): Promise<void> {
    const application = this.store.applications.find(candidate => this.store.keyOf(candidate) === row.key)
    if (!application) {
      return
    }

    if (action === ArgoApplicationActions.refresh) {
      await this.store.refresh(application, false)
      return
    }
    if (action === ArgoApplicationActions.hardRefresh) {
      await this.store.refresh(application, true)
    }
  }
}
</script>
