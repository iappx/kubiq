<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <ui-table-toolbar
          :columns="columns"
          :count="rows.length"
          :density="uiStore.density"
          :filter="activeFilter"
          :filter-placeholder="filterPlaceholder"
          :hidden-keys="hiddenKeys"
          :sorted="!!sort"
          :title="title"
          :total-count="state.total"
          @update:density="uiStore.setDensity($event)"
          @update:filter="setFilter"
          @update:hidden-keys="setHiddenKeys($event)"
      >
        <template #status>
          <span v-if="labelSelector" class="pill pill-active h-7 gap-1 py-0 pl-2.5 pr-0">
            <span :title="labelSelector" class="max-w-56 truncate font-mono">{{ labelSelector }}</span>
            <button
                :aria-label="`Remove label filter ${labelSelector}`"
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-r-md text-primary hover:bg-primary/15"
                title="Remove label filter"
                type="button"
                @click="clearFilter"
            >
              <x :size="12" aria-hidden="true" />
            </button>
          </span>

          <ui-live-indicator
              :since="state.staleSince"
              :state="liveState"
              @reconnect="reconnect"
          />
        </template>

        <template #actions>
          <button
              v-if="canCreateNamespace"
              aria-label="Create a namespace"
              class="btn-icon w-7 h-7"
              title="Create a namespace"
              type="button"
              @click="openCreateNamespace"
          >
            <circle-plus :size="14" />
          </button>

          <button
              v-if="canCreate"
              aria-label="Create a resource from YAML"
              class="btn-icon w-7 h-7"
              title="Create a resource from YAML"
              type="button"
              @click="openCreate"
          >
            <file-plus-2 :size="14" />
          </button>

          <button
              :disabled="state.loading"
              aria-label="Reload this list"
              class="btn-icon w-7 h-7"
              title="Reload this list"
              type="button"
              @click="reload"
          >
            <refresh-cw :class="state.loading ? 'animate-spin' : ''" :size="14" />
          </button>
        </template>
      </ui-table-toolbar>

      <event-scope-bar
          v-if="isEventList"
          :scope="eventScope"
          @update:scope="setEventScope"
      />

      <ui-error-state
          v-if="isUnserved"
          :message="`This cluster does not serve \`${slug}\`.`"
          hint="The sidebar lists what the cluster reports through discovery, so a link made against another cluster can name a kind this one has never had."
          retry-label="Open the overview"
          title="Kind not served here"
          @retry="openOverview"
      />

      <ui-error-state
          v-else-if="state.forbidden"
          :hint="forbiddenHint"
          :message="forbiddenMessage"
          :retryable="false"
          title="Not permitted"
      />

      <ui-error-state
          v-else-if="state.error"
          :detail="state.errorDetail"
          :message="state.error"
          :title="`Could not list ${title}`"
          @retry="reload"
      />

      <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
        <template #loading>
          <ui-skeletons :columns="columns.length" :count="12" :density="uiStore.density" type="table" />
        </template>
      </ui-deferred-loader>

      <template v-else>
        <resource-bulk-action-bar
            :busy="acting"
            :count="selectedRows.length"
            :kind="kind"
            @clear="clearSelection"
            @cordon="bulkCordon"
            @delete="askBulkDelete"
            @restart="bulkRestart"
            @uncordon="bulkUncordon"
        />

        <resource-table
            :actions="actions"
            :actions-of="rowActions"
            :busy-keys="busyKeys"
            :columns="columns"
            :cursor="cursor"
            :density="uiStore.density"
            :flash-keys="state.flashKeys"
            :hidden-keys="hiddenKeys"
            :label="title"
            :refreshing="state.loading"
            :rows="rows"
            :selected="selected"
            :sort="sort"
            @action="onAction"
            @open="openDetails"
            @update:cursor="cursor = $event"
            @update:selected="selected = $event"
            @update:sort="setSort($event)"
        >
          <template #empty>
            <empty-state
                v-if="isFiltered"
                :icon="searchIcon"
                :on-action="clearFilter"
                :title="`No ${title} match \`${activeFilter}\``"
                action-label="Clear filter"
                description="The filter matches a name; a query shaped like app=api is sent to the cluster as a label selector."
            />
            <empty-state
                v-else
                :icon="emptyIcon"
                :description="emptyDescription"
                :title="`No ${title} ${scopeLabel}`"
            />
          </template>
        </resource-table>

        <resource-load-more-bar
            :has-more="state.hasMore"
            :kind-title="title"
            :loaded="state.items.length"
            :loading="state.loadingMore"
            :total="state.total"
            @load-more="loadMore"
        />
      </template>
    </div>

    <resource-detail-panel
        :action-busy="selectedBusy"
        :active-tab="detailTab"
        :default-busy="defaultBusy"
        :kind="kind"
        :row="selectedRow"
        :tabs="detailTabs"
        :width="uiStore.panelWidth"
        @close="closeDetail"
        @copy-name="onDetailAction(actionKeys.copyNameKey)"
        @copy-yaml="onDetailAction(actionKeys.copyYamlKey)"
        @debug="onDetailAction(actionKeys.debugKey)"
        @delete="onDetailAction(actionKeys.deleteKey)"
        @forward="onDetailAction(actionKeys.forwardKey)"
        @logs="onDetailAction(actionKeys.logsKey)"
        @resume="onDetailAction(actionKeys.resumeKey)"
        @set-default="onDetailAction(actionKeys.setDefaultKey)"
        @shell="onDetailAction(actionKeys.shellKey)"
        @suspend="onDetailAction(actionKeys.suspendKey)"
        @trigger="onDetailAction(actionKeys.triggerKey)"
        @trigger-edit="onDetailAction(actionKeys.triggerEditKey)"
        @unset-default="onDetailAction(actionKeys.unsetDefaultKey)"
        @update:active-tab="selectTab($event)"
        @update:width="uiStore.setPanelWidth($event)"
    >
      <resource-detail-body
          v-if="detailTarget"
          :key="detailKey"
          :tab="detailTab"
          :target="detailTarget"
          @cancel-edit="cancelYamlEdit"
          @filter-label="setFilter($event)"
          @open="openRelated"
      />
    </resource-detail-panel>

    <resource-action-dialogs
        ref="dialogs"
        :cluster-id="clusterId"
        :create-namespace="createNamespace"
        :discard-open="pendingLeave !== null"
        :kind="kind"
        @clear-selection="clearSelection"
        @created="onCreated"
        @discard-edits="discardEdits"
        @keep-editing="keepEditing"
        @reload="reload"
        @update:acting="acting = $event"
    />
  </div>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { CirclePlus, FilePlus2, Inbox, RefreshCw, Search, X } from '@lucide/vue'
import type { Component as VueComponent } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import EventScopeBar from '@/components/resource/EventScopeBar.vue'
import ResourceActionDialogs from '@/components/resource/ResourceActionDialogs.vue'
import ResourceBulkActionBar from '@/components/resource/ResourceBulkActionBar.vue'
import ResourceDetailBody from '@/components/resource/detail/ResourceDetailBody.vue'
import ResourceDetailPanel from '@/components/resource/ResourceDetailPanel.vue'
import ResourceLoadMoreBar from '@/components/resource/ResourceLoadMoreBar.vue'
import ResourceTable from '@/components/resource/ResourceTable.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiLiveIndicator from '@/components/common/feedback/UiLiveIndicator.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiTableToolbar from '@/components/common/table/UiTableToolbar.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { MetricsColumns } from '@/components/metrics/MetricsColumns'
import { ResourceActions } from '@/components/resource/ResourceActions'
import { ResourceColumns } from '@/components/resource/ResourceColumns'
import { ResourceFilter } from '@/components/resource/ResourceFilter'
import { ResourceRowBuilder } from '@/components/resource/ResourceRowBuilder'
import { ResourceSelection } from '@/components/resource/ResourceSelection'
import { ResourceTargetBuilder } from '@/components/resource/ResourceTargetBuilder'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'
import type { TResourceListRequest } from '@/application/services/resourceList/types/TResourceListRequest'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { EventScopeService } from '@/application/services/eventScope/EventScopeService'
import { TablePrefsCodec } from '@/application/services/uiState/models/TablePrefsCodec'
import type { TEventScope } from '@/domain/entities/cluster'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { AppResumedEvent } from '@/domain/events/app/AppResumedEvent'
import { ClusterConnectedEvent } from '@/domain/events/cluster/ClusterConnectedEvent'
import { KubeAccessHint, KubeClusterCatalog, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { RouteQueryState } from '@/lib/router/query/RouteQueryState'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterMetricsStore } from '@/store/modules/clusterMetrics/ClusterMetricsStore'
import { ClusterResourceStore } from '@/store/modules/clusterResource/ClusterResourceStore'
import type { TResourceListState } from '@/store/modules/clusterResource/types/TResourceListState'
import { CustomResourceKindStore } from '@/store/modules/customResourceKind/CustomResourceKindStore'
import { DefaultClassStore } from '@/store/modules/defaultClass/DefaultClassStore'
import { NodeStore } from '@/store/modules/node/NodeStore'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import { ResourceYamlEditStore } from '@/store/modules/resourceYamlEdit/ResourceYamlEditStore'

@Component({
  components: {
    CirclePlus,
    EmptyState,
    EventScopeBar,
    FilePlus2,
    RefreshCw,
    ResourceActionDialogs,
    ResourceBulkActionBar,
    ResourceDetailBody,
    ResourceDetailPanel,
    ResourceLoadMoreBar,
    ResourceTable,
    UiDeferredLoader,
    UiErrorState,
    UiLiveIndicator,
    UiSkeletons,
    UiTableToolbar,
    X,
  },
})
export default class ResourcePage extends VueBase {
  public filterText = ''

  public labelSelector = ''

  public hiddenKeys: string[] = []

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  public selected: string[] = []

  public acting = false

  public eventScope: TEventScope = { type: '', objectKind: '', objectName: '' }

  public fieldSelector = ''

  public requestedTab: string = DetailTabs.overviewKey

  public pendingLeave: (() => void) | null = null

  private removeLeaveGuard!: () => void

  private watchedClusterId = ''

  private watchedKind: KubeResourceKind | null = null

  private onResumed!: () => void

  private onConnectivity!: (event: AppConnectivityEvent) => void

  private onConnected!: (event: ClusterConnectedEvent) => void

  private queryState!: RouteQueryState

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterDiscoveryStore) public readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterMetricsStore) public readonly metricsStore: ClusterMetricsStore,
      @inject(ClusterResourceStore) public readonly resourceStore: ClusterResourceStore,
      @inject(CustomResourceKindStore) public readonly customKindStore: CustomResourceKindStore,
      @inject(DefaultClassStore) public readonly defaultClassStore: DefaultClassStore,
      @inject(NodeStore) public readonly nodeStore: NodeStore,
      @inject(ResourceYamlEditStore) private readonly yamlEditStore: ResourceYamlEditStore,
      @inject(EventScopeService) private readonly eventScopeService: EventScopeService,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get actionKeys(): typeof ResourceActions {
    return ResourceActions
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public get slug(): string {
    const slug = this.$route.params.resource

    return typeof slug === 'string' ? slug : ''
  }

  public get kind(): KubeResourceKind | null {
    const served = this.discoveryStore.findBySlug(this.clusterId, this.slug)
        ?? KubeResourceRegistry.findBySlug(this.slug)
        ?? null

    return this.customKindStore.kindOf(this.clusterId, served)
  }

  // Discovery may replace the registry entry with a different API version, so reloads key off the kind, not the slug.
  public get kindKey(): string {
    return this.kind?.key ?? ''
  }

  public get tableKey(): string {
    return this.kindKey === '' ? '' : `resource:${this.kindKey}`
  }

  public get title(): string {
    return this.kind?.title ?? this.slug
  }

  public get state(): TResourceListState {
    return this.resourceStore.stateOf(this.clusterId, this.kind)
  }

  public get hasUsageColumns(): boolean {
    return MetricsColumns.supports(this.kind) && this.metricsStore.usageState(this.clusterId) === 'ready'
  }

  public get columns(): TUiTableColumn[] {
    const declared = this.kind?.columns ?? []

    return ResourceColumns.map(this.hasUsageColumns
      ? MetricsColumns.extend(declared, ResourceColumns.ageKey)
      : declared)
  }

  public get columnSignature(): string {
    return this.columns.map(column => column.key).join('|')
  }

  public get busyKeys(): string[] {
    return [
      ...this.state.busyKeys,
      ...this.nodeStore.busyRowKeys(this.clusterId),
      ...this.defaultClassStore.busyRowKeys(this.clusterId),
    ]
  }

  public get defaultBusy(): boolean {
    return !!this.selectedRow && this.defaultClassStore.busyRowKeys(this.clusterId).includes(this.selectedRow.key)
  }

  public get selectedBusy(): boolean {
    return !!this.selectedRow && this.state.busyKeys.includes(this.selectedRow.key)
  }

  public get isEventList(): boolean {
    return this.kind !== null && KubeClusterCatalog.isEvent(this.kind)
  }

  public get canCreateNamespace(): boolean {
    return this.canCreate && this.kind !== null && KubeClusterCatalog.isNamespace(this.kind) && this.kind.canCreate
  }

  public get allRows(): TResourceRow[] {
    const rows = ResourceRowBuilder.build(this.state.items, this.kind?.columns ?? [])
    if (!this.hasUsageColumns) {
      return rows
    }

    return rows.map(row => MetricsColumns.apply(row, this.usageOf(row)))
  }

  public get rows(): TResourceRow[] {
    return ResourceFilter.apply(this.allRows, this.filterText)
  }

  public get rowKeysSignature(): string {
    return this.rows.map(row => row.key).join('\0')
  }

  public get selectedRows(): TResourceRow[] {
    return ResourceTargetBuilder.selectedRows(this.rows, this.selected)
  }

  public get actions(): TUiMenuItem[] {
    return ResourceActions.of(this.kind)
  }

  public get rowActions(): (row: TResourceRow) => TUiMenuItem[] {
    const actions = this.actions

    return row => ResourceActions.forRow(actions, row)
  }

  public get hasSelection(): boolean {
    return ResourceSelection.isAddressable(this.kind, this.uiStore.detailNamespace, this.uiStore.detailName)
  }

  public get selectedRow(): TResourceRow | null {
    if (!this.hasSelection) {
      return null
    }

    return this.listedRow
        ?? ResourceSelection.rowOf(this.uiStore.detailNamespace, this.uiStore.detailName)
  }

  public get servedKinds(): KubeResourceKind[] {
    return this.discoveryStore.kindsOf(this.clusterId)
  }

  public get detailTabs(): TTab[] {
    return DetailTabs.of(this.kind)
  }

  public get detailTab(): string {
    return ResourceSelection.tabOf(this.detailTabs, this.requestedTab)
  }

  public get detailTarget(): TResourceObjectRef | null {
    const kind = this.kind
    if (!kind || !this.hasSelection) {
      return null
    }

    return {
      clusterId: this.clusterId,
      kind,
      name: this.uiStore.detailName,
      namespace: this.uiStore.detailNamespace,
      served: this.servedKinds,
    }
  }

  public get isUnserved(): boolean {
    return this.discoveryStore.isDiscovered(this.clusterId)
        && !this.discoveryStore.isLoading(this.clusterId)
        && this.discoveryStore.findBySlug(this.clusterId, this.slug) === undefined
  }

  public get detailKey(): string {
    return this.detailTarget ? ResourceObjectStore.keyOf(this.detailTarget) : ''
  }

  public get canCreate(): boolean {
    return this.connectionStore.isConnected(this.clusterId)
  }

  public get createNamespace(): string {
    return this.namespaces.length === 1 ? this.namespaces[0] : ''
  }

  public get namespaces(): string[] {
    return this.connectionStore.namespacesOf(this.clusterId)
  }

  public get liveState(): 'live' | 'stale' | 'off' {
    if (this.state.watching) {
      return 'live'
    }

    return this.state.staleSince > 0 ? 'stale' : 'off'
  }

  public get scopeLabel(): string {
    if (!this.kind?.namespaced || this.namespaces.length === 0) {
      return 'in this cluster'
    }

    return this.namespaces.length === 1
        ? `in ${this.namespaces[0]}`
        : `in the ${this.namespaces.length} selected namespaces`
  }

  public get emptyDescription(): string {
    return this.kind?.canCreate === true
        ? `Nothing of this kind exists yet. Apply a manifest with kubectl and it appears here.`
        : 'Nothing of this kind exists in the current scope.'
  }

  public get forbiddenMessage(): string {
    return `You cannot list ${this.title} ${this.scopeLabel}.`
  }

  public get forbiddenHint(): string {
    return KubeAccessHint.of('list', this.kind, this.namespaces.length === 1 ? this.namespaces[0] : '')
  }

  public get filterPlaceholder(): string {
    return `Filter ${this.title.toLowerCase()} by name or label`
  }

  public get activeFilter(): string {
    return this.filterText || this.labelSelector
  }

  public get isFiltered(): boolean {
    return (this.filterText !== '' && this.allRows.length > 0) || this.labelSelector !== ''
  }

  public get showSkeleton(): boolean {
    return this.state.loading && !this.state.loaded
  }

  public get searchIcon(): VueComponent {
    return Search
  }

  public get emptyIcon(): VueComponent {
    return Inbox
  }

  private get listedRow(): TResourceRow | null {
    return this.allRows.find(row => row.name === this.uiStore.detailName
        && row.namespace === this.uiStore.detailNamespace) ?? null
  }

  private dialogs(): InstanceType<typeof ResourceActionDialogs> | undefined {
    return this.$refs.dialogs as InstanceType<typeof ResourceActionDialogs> | undefined
  }

  async created(): Promise<void> {
    this.onResumed = () => void this.reconnect()
    this.onConnectivity = (event: AppConnectivityEvent) => {
      if (event.online) {
        void this.reconnect()
      }
    }
    this.onConnected = (event: ClusterConnectedEvent) => {
      if (event.clusterId === this.clusterId) {
        void this.reconnect()
      }
    }
    this.eventBus.registerHandler(AppResumedEvent, this.onResumed)
    this.eventBus.registerHandler(AppConnectivityEvent, this.onConnectivity)
    this.eventBus.registerHandler(ClusterConnectedEvent, this.onConnected)
    this.removeLeaveGuard = this.$router.beforeEach((to, from) => this.guardRoute(to, from))

    this.resetView()
    this.queryState = new RouteQueryState(
      this.$router,
      ResourceSelection.fields(this.uiStore, () => this.requestedTab, (tab) => { this.requestedTab = tab }),
    )
    this.queryState.start()
    this.dropUnaddressable()

    await this.resolveCustomColumns()
    await this.reload()
  }

  async beforeUnmount(): Promise<void> {
    this.queryState.stop()
    this.removeLeaveGuard()
    this.eventBus.unregisterHandler(AppResumedEvent, this.onResumed)
    this.eventBus.unregisterHandler(AppConnectivityEvent, this.onConnectivity)
    this.eventBus.unregisterHandler(ClusterConnectedEvent, this.onConnected)
    this.uiStore.closeDetail()
    await this.stopWatch()
  }

  @Watch('slug')
  slugChanged(): void {
    this.resetView()
  }

  @Watch('kindKey')
  async kindChanged(): Promise<void> {
    this.dropUnaddressable()
    this.restoreTablePrefs()
    await this.resolveCustomColumns()
    await this.reload()
  }

  @Watch('columnSignature')
  columnsChanged(): void {
    this.restoreTablePrefs()
  }

  @Watch('namespaces')
  async namespacesChanged(): Promise<void> {
    await this.reload()
  }

  @Watch('rowKeysSignature')
  rowsChanged(): void {
    if (this.selected.length === 0) {
      return
    }

    const pruned = ResourceTargetBuilder.pruneSelected(this.rows, this.selected)
    if (pruned.length !== this.selected.length) {
      this.selected = pruned
    }
  }

  public async setFilter(query: string): Promise<void> {
    const parsed = ResourceFilter.parse(query)
    const selectorChanged = parsed.labelSelector !== this.labelSelector

    this.filterText = parsed.text
    this.labelSelector = parsed.labelSelector

    // Only a label selector costs a request; text narrows what is already loaded.
    if (selectorChanged) {
      await this.reload()
    }
  }

  public clearFilter(): void {
    void this.setFilter('')
  }

  public clearSelection(): void {
    this.selected = []
  }

  public setHiddenKeys(keys: string[]): void {
    this.hiddenKeys = keys
    if (this.tableKey !== '') {
      const merged = TablePrefsCodec.mergeHiddenKeys(
        this.uiStore.tablePrefsOf(this.tableKey)?.hiddenKeys,
        keys,
        this.columns.map(column => column.key),
      )
      this.uiStore.setTableHiddenKeys(this.tableKey, merged)
    }
  }

  public setSort(sort: TUiTableSort | null): void {
    this.sort = sort
    if (this.tableKey !== '') {
      this.uiStore.setTableSort(this.tableKey, sort)
    }
  }

  public async setEventScope(scope: TEventScope): Promise<void> {
    const kind = this.kind
    if (!kind) {
      return
    }

    this.eventScope = scope
    this.fieldSelector = this.eventScopeService.fieldSelectorFor(this.clusterId, kind, scope)

    await this.reload()
  }

  public openDetails(row: TResourceRow): void {
    if (this.isDetailOf(row)) {
      this.showDetails(row)
      return
    }

    this.leave(() => this.showDetails(row))
  }

  public selectTab(tab: string): void {
    if (tab !== this.detailTab) {
      this.leave(() => { this.requestedTab = tab })
    }
  }

  public closeDetail(): void {
    this.leave(() => this.uiStore.closeDetail())
  }

  public cancelYamlEdit(): void {
    this.leave(() => this.yamlEditStore.discard())
  }

  public keepEditing(): void {
    this.pendingLeave = null
  }

  public discardEdits(): void {
    const action = this.pendingLeave
    this.pendingLeave = null
    this.yamlEditStore.discard()
    action?.()
  }

  public openOverview(): void {
    void this.$router.push(ClusterRoutes.overview(this.clusterId))
  }

  public openCreate(): void {
    this.leave(() => {
      this.uiStore.closeDetail()
      this.dialogs()?.openCreate()
    })
  }

  public openCreateNamespace(): void {
    this.dialogs()?.openCreateNamespace()
  }

  public async onCreated(created: { kind: KubeResourceKind; name: string; namespace: string }): Promise<void> {
    if (created.kind.key === this.kindKey) {
      await this.reload()
    } else {
      await this.$router.push(ClusterRoutes.forKind(this.clusterId, created.kind))
    }
  }

  public async openRelated(related: TRelatedObject): Promise<void> {
    if (!related.kind) {
      return
    }

    if (related.kind.key === this.kindKey) {
      this.uiStore.openDetail(related.namespace, related.name)
      this.requestedTab = DetailTabs.overviewKey

      return
    }

    await this.$router.push(ClusterRoutes.object(this.clusterId, related.kind, {
      namespace: related.namespace,
      name: related.name,
    }))
  }

  public async reload(): Promise<void> {
    const request = this.request()
    if (!request) {
      return
    }

    await this.stopWatch()
    await this.resourceStore.load(request)
    await this.startWatch(request)
    await this.loadUsage()
  }

  public async loadMore(): Promise<void> {
    const request = this.request()
    if (!request) {
      return
    }

    await this.resourceStore.loadMore(request)
    await this.loadUsage()
  }

  public reconnect(): Promise<void> {
    return this.reload()
  }

  public onAction(event: { action: string; row: TResourceRow }): void {
    if (event.action === ResourceActions.openKey) {
      this.openDetails(event.row)
      return
    }
    if (event.action === ResourceActions.editYamlKey) {
      this.editYaml(event.row)
      return
    }

    this.dialogs()?.handleAction(event.action, event.row)
  }

  public onDetailAction(action: string): void {
    if (this.selectedRow) {
      this.dialogs()?.handleAction(action, this.selectedRow)
    }
  }

  public askBulkDelete(): void {
    this.dialogs()?.askBulkDelete(this.selectedRows)
  }

  public bulkRestart(): void {
    void this.dialogs()?.bulkRestart(this.selectedRows)
  }

  public bulkCordon(): void {
    void this.dialogs()?.bulkCordon(this.selectedRows)
  }

  public bulkUncordon(): void {
    void this.dialogs()?.bulkUncordon(this.selectedRows)
  }

  private editYaml(row: TResourceRow): void {
    const kind = this.kind
    if (!kind) {
      return
    }

    const key = ResourceObjectStore.keyOf({
      clusterId: this.clusterId,
      kind,
      name: row.name,
      namespace: row.namespace,
      served: this.servedKinds,
    })
    const open = () => {
      this.showDetails(row)
      this.requestedTab = DetailTabs.yamlKey
      this.yamlEditStore.request(key)
    }

    if (this.isDetailOf(row)) {
      open()
      return
    }

    this.leave(open)
  }

  private showDetails(row: TResourceRow): void {
    this.dialogs()?.closeCreate()
    this.uiStore.openDetail(row.namespace, row.name)
  }

  private isDetailOf(row: TResourceRow): boolean {
    return this.uiStore.detailName === row.name && this.uiStore.detailNamespace === row.namespace
  }

  private leave(action: () => void): void {
    if (this.yamlEditStore.hasUnsavedChanges) {
      this.pendingLeave = action
      return
    }

    this.yamlEditStore.discard()
    action()
  }

  private guardRoute(to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
    if (!this.yamlEditStore.hasUnsavedChanges || to.fullPath === from.fullPath) {
      return true
    }

    this.pendingLeave = () => void this.$router.push(to.fullPath)

    return false
  }

  private resolveCustomColumns(): Promise<void> {
    return this.customKindStore.resolve(this.clusterId, this.kind)
  }

  private usageOf(row: TResourceRow): TResourceUsage | null {
    return MetricsColumns.isPodKind(this.kind)
      ? this.metricsStore.podUsage(this.clusterId, row.namespace, row.name)
      : this.metricsStore.nodeUsage(this.clusterId, row.name)
  }

  private async loadUsage(): Promise<void> {
    if (!MetricsColumns.supports(this.kind) || !this.connectionStore.isConnected(this.clusterId)) {
      return
    }

    await this.metricsStore.load(
      this.clusterId,
      MetricsColumns.isPodKind(this.kind) ? this.namespaces : [],
    )
  }

  // Only once the kind is known can an address be judged: before that every tab and every
  // namespace is still plausible, and throwing one away would break a cold deep link.
  private dropUnaddressable(): void {
    if (!this.kind) {
      return
    }

    this.requestedTab = this.detailTab
    if (this.uiStore.detailOpen && !this.hasSelection) {
      this.uiStore.closeDetail()
    }
  }

  private request(): TResourceListRequest | null {
    const kind = this.kind
    if (!kind || this.isUnserved || !this.connectionStore.isConnected(this.clusterId)) {
      return null
    }
    // The scope arriving is itself a reload, so refusing here costs nothing and never lists wide.
    if (!this.connectionStore.isScopeKnown(this.clusterId)) {
      return null
    }

    return {
      clusterId: this.clusterId,
      kind,
      namespaces: this.namespaces,
      labelSelector: this.labelSelector,
      fieldSelector: this.fieldSelector,
    }
  }

  private async startWatch(request: TResourceListRequest): Promise<void> {
    await this.resourceStore.watch(request)
    this.watchedClusterId = request.clusterId
    this.watchedKind = request.kind
  }

  // The watched kind is remembered, not re-derived: by unmount the route already names the next one.
  private async stopWatch(): Promise<void> {
    const kind = this.watchedKind
    const clusterId = this.watchedClusterId
    if (!kind) {
      return
    }

    this.watchedKind = null
    this.watchedClusterId = ''
    await this.resourceStore.unwatch(clusterId, kind)
  }

  private resetView(): void {
    this.filterText = ''
    this.labelSelector = ''
    this.fieldSelector = ''
    this.eventScope = { type: '', objectKind: '', objectName: '' }
    this.cursor = null
    this.selected = []
    this.dialogs()?.reset()
    this.restoreTablePrefs()
  }

  private restoreTablePrefs(): void {
    const columns = this.columns
    if (this.tableKey === '') {
      this.hiddenKeys = ResourceColumns.defaultHidden(columns)
      this.sort = null
      return
    }

    const stored = this.uiStore.tablePrefsOf(this.tableKey)

    this.hiddenKeys = TablePrefsCodec.resolveHiddenKeys(
      stored?.hiddenKeys,
      columns.map(column => column.key),
      columns.filter(column => column.locked === true).map(column => column.key),
      ResourceColumns.defaultHidden(columns),
    )
    this.sort = TablePrefsCodec.resolveSort(
      stored?.sort,
      columns.filter(column => column.sortable !== false).map(column => column.key),
    )
  }
}
</script>
