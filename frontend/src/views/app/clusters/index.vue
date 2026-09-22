<template>
  <div class="flex h-full min-h-0">
    <div class="flex flex-1 min-w-0 flex-col surface overflow-hidden">
      <cluster-pinned-strip
          v-if="pinnedRows.length > 0"
          :rows="pinnedRows"
          @enter="enter"
          @unpin="togglePin"
      />

      <cluster-source-bar
          v-if="catalogStore.sources.length > 0"
          :sources="catalogStore.sources"
          @remove="catalogStore.removeSource($event)"
      />

      <ui-table-toolbar
          :columns="columns"
          :count="rows.length"
          :density="density"
          :filter="catalogStore.filter"
          :hidden-keys="hiddenKeys"
          :sorted="!!sort"
          :total-count="allRows.length"
          filter-placeholder="Filter clusters by name, server or namespace"
          title="Clusters"
          @update:density="density = $event"
          @update:filter="catalogStore.setFilter($event)"
          @update:hidden-keys="hiddenKeys = $event"
      >
        <template #status>
          <span v-if="connectionStore.hasConnections" class="pill pill-active tabular">
            {{ connectionStore.connections.length }} connected
          </span>
        </template>

        <template #actions>
          <button class="btn-secondary" type="button" @click="addOpen = true">
            <file-plus :size="14" />
            Add kubeconfig
          </button>
          <button
              :disabled="catalogStore.storeLoading"
              aria-label="Reload the catalog"
              class="btn-icon w-7 h-7"
              title="Reload the catalog"
              type="button"
              @click="catalogStore.refresh()"
          >
            <refresh-cw :class="catalogStore.storeLoading ? 'animate-spin' : ''" :size="14" />
          </button>
        </template>
      </ui-table-toolbar>

      <ui-error-state
          v-if="catalogStore.loadError"
          :detail="catalogStore.loadErrorDetail"
          :message="catalogStore.loadError"
          title="Could not read the cluster catalog"
          @retry="catalogStore.refresh()"
      />

      <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
        <template #loading>
          <ui-skeletons :columns="6" :count="6" :density="density" type="table" />
        </template>
      </ui-deferred-loader>

      <cluster-catalog-table
          v-else
          :busy-keys="connectionStore.connectingIds"
          :columns="columns"
          :cursor="cursor"
          :density="density"
          :hidden-keys="hiddenKeys"
          :rows="rows"
          :sort="sort"
          :total-count="allRows.length"
          @connect="connect"
          @details="select"
          @disconnect="connectionStore.disconnect($event)"
          @open="enter"
          @toggle-pin="togglePin"
          @update:cursor="cursor = $event"
          @update:sort="sort = $event"
      >
        <template #empty>
          <empty-state
              v-if="isFiltered"
              :icon="searchIcon"
              :on-action="clearFilter"
              :title="`No clusters match \`${catalogStore.filter}\``"
              action-label="Clear filter"
              description="The filter matches a context name, cluster name, server address or namespace."
          />
          <empty-state
              v-else
              :icon="serverIcon"
              :on-action="openAdd"
              action-label="Add kubeconfig"
              description="Kubiq reads ~/.kube/config and every file named by KUBECONFIG. Point it at a kubeconfig to get started."
              title="No Kubernetes contexts found"
          />
        </template>
      </cluster-catalog-table>
    </div>

    <cluster-detail-panel
        :namespace-options="namespaceOptions"
        :namespaces="selectedNamespaces"
        :row="selectedRow"
        :width="panelWidth"
        @close="selectedId = ''"
        @disconnect="connectionStore.disconnect($event)"
        @enter="enterById"
        @toggle-pin="togglePin"
        @update:namespaces="setNamespaces"
        @update:width="panelWidth = $event"
    />

    <add-kubeconfig-modal :busy="addBusy" :open="addOpen" @close="addOpen = false" @submit="addSource" />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { FilePlus, RefreshCw, Search, Server } from '@lucide/vue'
import type { Component as VueComponent } from 'vue'
import AddKubeconfigModal from '@/components/cluster/AddKubeconfigModal.vue'
import ClusterCatalogTable from '@/components/cluster/ClusterCatalogTable.vue'
import ClusterDetailPanel from '@/components/cluster/ClusterDetailPanel.vue'
import ClusterPinnedStrip from '@/components/cluster/ClusterPinnedStrip.vue'
import ClusterSourceBar from '@/components/cluster/ClusterSourceBar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiTableToolbar from '@/components/common/table/UiTableToolbar.vue'
import { ClusterCatalogColumns } from '@/components/cluster/ClusterCatalogColumns'
import { ClusterRowBuilder } from '@/components/cluster/ClusterRowBuilder'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'

@Component({
  components: {
    AddKubeconfigModal,
    ClusterCatalogTable,
    ClusterDetailPanel,
    ClusterPinnedStrip,
    ClusterSourceBar,
    EmptyState,
    FilePlus,
    RefreshCw,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
    UiTableToolbar,
  },
})
export default class ClustersPage extends VueBase {
  private static readonly defaultPanelWidth = 460

  public density: TUiTableDensity = 'compact'

  public hiddenKeys: string[] = ClusterCatalogColumns.defaultHidden()

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  public selectedId = ''

  public panelWidth = ClustersPage.defaultPanelWidth

  public addOpen = false

  public addBusy = false

  constructor(
      @inject(ClusterCatalogStore) public readonly catalogStore: ClusterCatalogStore,
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterHealthStore) public readonly healthStore: ClusterHealthStore,
      @inject(ClusterNamespaceStore) public readonly namespaceStore: ClusterNamespaceStore,
  ) {
    super()
  }

  public get columns(): TUiTableColumn[] {
    return ClusterCatalogColumns.all()
  }

  public get allRows(): TClusterRow[] {
    return ClusterRowBuilder.build({
      contexts: this.catalogStore.items,
      connections: this.connectionStore.connections,
      pinned: this.catalogStore.pinned,
      connectingIds: this.connectionStore.connectingIds,
      failures: this.connectionStore.failures,
      health: this.healthStore.health,
      activeClusterId: this.connectionStore.activeClusterId,
    })
  }

  public get rows(): TClusterRow[] {
    return ClusterRowBuilder.filter(this.allRows, this.catalogStore.filter)
  }

  public get pinnedRows(): TClusterRow[] {
    return ClusterRowBuilder.pinnedOf(this.allRows, this.catalogStore.pinned)
  }

  public get selectedRow(): TClusterRow | null {
    return this.allRows.find(row => row.clusterId === this.selectedId) ?? null
  }

  public get selectedNamespaces(): string[] {
    return this.selectedId ? this.connectionStore.namespacesOf(this.selectedId) : []
  }

  public get namespaceOptions(): TUiSelectOption[] {
    return this.namespaceStore
        .availableOf(this.selectedId)
        .map(name => ({ key: name, title: name }))
  }

  public get isFiltered(): boolean {
    return this.catalogStore.filter.trim().length > 0 && this.allRows.length > 0
  }

  public get showSkeleton(): boolean {
    return this.catalogStore.storeLoading && !this.catalogStore.storeLoaded
  }

  public get searchIcon(): VueComponent {
    return Search
  }

  public get serverIcon(): VueComponent {
    return Server
  }

  async created(): Promise<void> {
    await Promise.all([
      this.catalogStore.loadOnce(),
      this.connectionStore.loadNamespaces(),
    ])

    await this.connectionStore.adopt(this.catalogStore.items.map(context => context.name))
  }

  public select(row: TClusterRow): void {
    this.selectedId = row.clusterId
    if (row.status === 'connected') {
      void this.namespaceStore.loadFor(row.clusterId)
    }
  }

  public enter(row: TClusterRow): void {
    if (row.status === 'unsupported') {
      this.select(row)
      return
    }

    void this.enterById(row.clusterId)
  }

  public async enterById(clusterId: string): Promise<void> {
    if (!this.connectionStore.isConnected(clusterId)) {
      await this.connectionStore.connect(clusterId, this.catalogStore.sources)

      if (!this.connectionStore.isConnected(clusterId)) {
        return
      }
    }

    this.connectionStore.activate(clusterId)
    void this.namespaceStore.loadFor(clusterId)
    await this.$router.push(ClusterRoutes.overview(clusterId))
  }

  public async connect(clusterId: string): Promise<void> {
    await this.connectionStore.connect(clusterId, this.catalogStore.sources)

    if (this.connectionStore.isConnected(clusterId)) {
      await this.namespaceStore.loadFor(clusterId)
    }
  }

  public togglePin(clusterId: string): void {
    void this.catalogStore.togglePin(clusterId)
  }

  public setNamespaces(namespaces: string[]): void {
    if (this.selectedId) {
      void this.connectionStore.setNamespaces(this.selectedId, namespaces)
    }
  }

  public clearFilter(): void {
    this.catalogStore.setFilter('')
  }

  public openAdd(): void {
    this.addOpen = true
  }

  public async addSource(path: string): Promise<void> {
    this.addBusy = true
    try {
      if (await this.catalogStore.addSource(path)) {
        this.addOpen = false
      }
    } finally {
      this.addBusy = false
    }
  }
}
</script>
