<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <ui-table-toolbar
          :columns="columns"
          :count="rows.length"
          :density="uiStore.density"
          :filter="filterText"
          :filter-placeholder="filterPlaceholder"
          :hidden-keys="hiddenKeys"
          :sorted="!!sort"
          :title="title"
          :total-count="state.total"
          @update:density="uiStore.setDensity($event)"
          @update:filter="setFilter"
          @update:hidden-keys="hiddenKeys = $event"
      >
        <template #status>
          <span v-if="labelSelector" class="pill pill-active">{{ labelSelector }}</span>

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
              @click="creatingNamespace = true"
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
          v-if="state.forbidden"
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

      <resource-table
          v-else
          :actions="actions"
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
          @update:sort="sort = $event"
      >
        <template #empty>
          <empty-state
              v-if="isFiltered"
              :icon="searchIcon"
              :on-action="clearFilter"
              :title="`No ${title} match \`${filterText}\``"
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
    </div>

    <resource-detail-panel
        :active-tab="detailTab"
        :kind="kind"
        :row="selectedRow"
        :tabs="detailTabs"
        :width="uiStore.panelWidth"
        @close="uiStore.closeDetail()"
        @delete="askDelete(selectedRow)"
        @forward="openPortForward(selectedRow)"
        @shell="openShell(selectedRow)"
        @update:active-tab="detailTab = $event"
        @update:width="uiStore.setPanelWidth($event)"
    >
      <resource-detail-body
          v-if="detailTarget"
          :key="detailKey"
          :tab="detailTab"
          :target="detailTarget"
          @open="openRelated"
      />
    </resource-detail-panel>

    <create-resource-panel
        :cluster-id="clusterId"
        :kind="kind"
        :namespace="createNamespace"
        :open="creating"
        :served="servedKinds"
        :width="uiStore.panelWidth"
        @close="creating = false"
        @created="onCreated"
        @update:width="uiStore.setPanelWidth($event)"
    />

    <delete-resource-dialog
        :busy="acting"
        :kind="kind"
        :open="!!pendingDelete"
        :row="pendingDelete"
        @cancel="pendingDelete = null"
        @confirm="confirmDelete"
    />

    <scale-workload-dialog
        :busy="acting"
        :current="pendingScaleReplicas"
        :kind="kind"
        :open="!!pendingScale"
        :row="pendingScale"
        @cancel="pendingScale = null"
        @confirm="confirmScale"
    />

    <drain-node-dialog
        :busy="acting"
        :open="!!pendingDrain"
        :row="pendingDrain"
        @cancel="pendingDrain = null"
        @confirm="confirmDrain"
    />

    <create-namespace-dialog
        :busy="namespaceStore.creating"
        :open="creatingNamespace"
        @cancel="creatingNamespace = false"
        @confirm="confirmCreateNamespace"
    />
  </div>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { CirclePlus, FilePlus2, Inbox, RefreshCw, Search } from '@lucide/vue'
import type { Component as VueComponent } from 'vue'
import CreateNamespaceDialog from '@/components/resource/CreateNamespaceDialog.vue'
import CreateResourcePanel from '@/components/resource/CreateResourcePanel.vue'
import DeleteResourceDialog from '@/components/resource/DeleteResourceDialog.vue'
import DrainNodeDialog from '@/components/resource/DrainNodeDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import EventScopeBar from '@/components/resource/EventScopeBar.vue'
import ResourceDetailBody from '@/components/resource/detail/ResourceDetailBody.vue'
import ResourceDetailPanel from '@/components/resource/ResourceDetailPanel.vue'
import ResourceTable from '@/components/resource/ResourceTable.vue'
import ScaleWorkloadDialog from '@/components/resource/ScaleWorkloadDialog.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiLiveIndicator from '@/components/common/feedback/UiLiveIndicator.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiTableToolbar from '@/components/common/table/UiTableToolbar.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { ResourceActions } from '@/components/resource/ResourceActions'
import { MetricsColumns } from '@/components/metrics/MetricsColumns'
import { ResourceColumns } from '@/components/resource/ResourceColumns'
import { ResourceFilter } from '@/components/resource/ResourceFilter'
import { ResourceRowBuilder } from '@/components/resource/ResourceRowBuilder'
import { ResourceWorkload } from '@/components/resource/ResourceWorkload'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TResourceListRequest } from '@/application/services/resourceList/types/TResourceListRequest'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import type { TWorkloadTarget } from '@/application/services/workloadAction/types/TWorkloadTarget'
import { OpenPodLogsEvent } from '@/domain/events/cluster/OpenPodLogsEvent'
import { OpenPodShellEvent } from '@/domain/events/terminal/OpenPodShellEvent'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { EventScopeService } from '@/application/services/eventScope/EventScopeService'
import type { TNodeTarget } from '@/application/services/node/types/TNodeTarget'
import type { TEventScope } from '@/domain/entities/cluster'
import { KubeClusterCatalog, KubeKindLocator, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterMetricsStore } from '@/store/modules/clusterMetrics/ClusterMetricsStore'
import { ClusterResourceStore } from '@/store/modules/clusterResource/ClusterResourceStore'
import { CustomResourceKindStore } from '@/store/modules/customResourceKind/CustomResourceKindStore'
import { NamespaceStore } from '@/store/modules/namespace/NamespaceStore'
import { NodeStore } from '@/store/modules/node/NodeStore'
import type { TResourceListState } from '@/store/modules/clusterResource/types/TResourceListState'

@Component({
  components: {
    CirclePlus,
    CreateNamespaceDialog,
    CreateResourcePanel,
    DeleteResourceDialog,
    DrainNodeDialog,
    EmptyState,
    EventScopeBar,
    FilePlus2,
    RefreshCw,
    ResourceDetailBody,
    ResourceDetailPanel,
    ResourceTable,
    ScaleWorkloadDialog,
    UiDeferredLoader,
    UiErrorState,
    UiLiveIndicator,
    UiSkeletons,
    UiTableToolbar,
  },
})
export default class ResourcePage extends VueBase {
  public filterText = ''

  public labelSelector = ''

  public hiddenKeys: string[] = []

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  public selected: string[] = []

  public pendingDelete: TResourceRow | null = null

  public pendingScale: TResourceRow | null = null

  public pendingDrain: TResourceRow | null = null

  public acting = false

  public creating = false

  public creatingNamespace = false

  public eventScope: TEventScope = { type: '', objectKind: '', objectName: '' }

  public fieldSelector = ''

  public detailTab: string = DetailTabs.overviewKey

  private watchedClusterId = ''

  private watchedKind: KubeResourceKind | null = null

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterDiscoveryStore) public readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterMetricsStore) public readonly metricsStore: ClusterMetricsStore,
      @inject(ClusterResourceStore) public readonly resourceStore: ClusterResourceStore,
      @inject(CustomResourceKindStore) public readonly customKindStore: CustomResourceKindStore,
      @inject(NamespaceStore) public readonly namespaceStore: NamespaceStore,
      @inject(NodeStore) public readonly nodeStore: NodeStore,
      @inject(ResourceObjectStore) public readonly objectStore: ResourceObjectStore,
      @inject(EventScopeService) private readonly eventScopeService: EventScopeService,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
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
    return [...this.state.busyKeys, ...this.nodeStore.busyRowKeys(this.clusterId)]
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

  public get actions(): TUiMenuItem[] {
    return ResourceActions.of(this.kind)
  }

  public get selectedRow(): TResourceRow | null {
    return this.allRows.find(row => row.key === this.uiStore.detailKey) ?? null
  }

  public get servedKinds(): KubeResourceKind[] {
    return this.discoveryStore.kindsOf(this.clusterId)
  }

  public get detailTabs(): TTab[] {
    return DetailTabs.of(this.kind)
  }

  public get detailTarget(): TResourceObjectRef | null {
    const row = this.selectedRow
    const kind = this.kind

    return row && kind
        ? { clusterId: this.clusterId, kind, name: row.name, namespace: row.namespace, served: this.servedKinds }
        : null
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

  public get pendingScaleReplicas(): number {
    return ResourceWorkload.desiredReplicas(this.entityOf(this.pendingScale))
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

  public get filterPlaceholder(): string {
    return `Filter ${this.title.toLowerCase()} by name or label`
  }

  public get isFiltered(): boolean {
    return this.filterText !== '' && this.allRows.length > 0
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

  async created(): Promise<void> {
    this.resetView()
    await this.resolveCustomColumns()
    await this.reload()
  }

  async beforeUnmount(): Promise<void> {
    await this.stopWatch()
  }

  @Watch('slug')
  slugChanged(): void {
    this.resetView()
  }

  @Watch('kindKey')
  async kindChanged(): Promise<void> {
    await this.resolveCustomColumns()
    await this.reload()
  }

  @Watch('columnSignature')
  columnsChanged(): void {
    this.hiddenKeys = ResourceColumns.defaultHidden(this.columns)
  }

  @Watch('namespaces')
  async namespacesChanged(): Promise<void> {
    await this.reload()
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
    this.creating = false
    this.uiStore.openDetail(row.key)
  }

  public openCreate(): void {
    this.uiStore.closeDetail()
    this.creating = true
  }

  public async onCreated(created: { kind: KubeResourceKind; name: string; namespace: string }): Promise<void> {
    this.creating = false

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

    if (related.kind.key !== this.kindKey) {
      await this.$router.push(ClusterRoutes.forKind(this.clusterId, related.kind))
      await this.reload()
    }

    const row = this.allRows.find(candidate => candidate.name === related.name
        && candidate.namespace === related.namespace)

    if (row) {
      this.uiStore.openDetail(row.key)
      this.detailTab = DetailTabs.overviewKey
    }
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

  public reconnect(): Promise<void> {
    return this.reload()
  }

  public onAction(event: { action: string; row: TResourceRow }): void {
    switch (event.action) {
      case ResourceActions.openKey:
        this.openDetails(event.row)
        return
      case ResourceActions.logsKey:
        this.openLogs(event.row)
        return
      case ResourceActions.shellKey:
        this.openShell(event.row)
        return
      case ResourceActions.forwardKey:
        this.openPortForward(event.row)
        return
      case ResourceActions.scaleKey:
        this.pendingScale = event.row
        return
      case ResourceActions.restartKey:
        void this.restart(event.row)
        return
      case ResourceActions.triggerKey:
        void this.trigger(event.row)
        return
      case ResourceActions.cordonKey:
        void this.setScheduling(event.row, true)
        return
      case ResourceActions.uncordonKey:
        void this.setScheduling(event.row, false)
        return
      case ResourceActions.drainKey:
        this.pendingDrain = event.row
        return
      case ResourceActions.deleteKey:
        this.askDelete(event.row)
    }
  }

  public askDelete(row: TResourceRow | null): void {
    this.pendingDelete = row
  }

  public async confirmDelete(): Promise<void> {
    const target = this.targetOf(this.pendingDelete)
    if (!target) {
      return
    }

    const removed = await this.run(() => this.resourceStore.remove(target))
    this.pendingDelete = null

    if (!removed) {
      return
    }
    if (this.uiStore.detailKey === target.rowKey) {
      this.uiStore.closeDetail()
    }
    // A live watch reports the removal itself; without one nothing else tells the list its row is gone.
    if (!this.state.watching) {
      await this.reload()
    }
  }

  public async confirmScale(replicas: number): Promise<void> {
    const target = this.targetOf(this.pendingScale)
    if (!target) {
      return
    }

    await this.run(() => this.resourceStore.scale(target, replicas))
    this.pendingScale = null
  }

  public async confirmDrain(): Promise<void> {
    const target = this.nodeTargetOf(this.pendingDrain)
    const podsKind = this.podsKind()
    if (!target || !podsKind) {
      return
    }

    await this.run(() => this.nodeStore.drain({ target, podsKind }))
    this.pendingDrain = null

    if (!this.state.watching) {
      await this.reload()
    }
  }

  public async confirmCreateNamespace(name: string): Promise<void> {
    const kind = this.kind
    if (!kind) {
      return
    }

    const created = await this.namespaceStore.create({ clusterId: this.clusterId, kind, name })
    if (!created) {
      return
    }

    this.creatingNamespace = false
    if (!this.state.watching) {
      await this.reload()
    }
  }

  private openLogs(row: TResourceRow): void {
    this.eventBus.emitEvent(new OpenPodLogsEvent(this.clusterId, row.namespace, row.name))
  }

  public openShell(row: TResourceRow | null): void {
    if (row) {
      this.eventBus.emitEvent(new OpenPodShellEvent(this.clusterId, row.namespace, row.name))
    }
  }

  public openPortForward(row: TResourceRow | null): void {
    const kind = this.kind
    if (row && kind) {
      this.eventBus.emitEvent(new OpenPortForwardEvent(this.clusterId, row.namespace, kind.resource, row.name))
    }
  }

  private async restart(row: TResourceRow): Promise<void> {
    const target = this.targetOf(row)
    if (target) {
      await this.run(() => this.resourceStore.restart(target))
    }
  }

  private async trigger(row: TResourceRow): Promise<void> {
    const target = this.targetOf(row)
    const cronJob = ResourceWorkload.asCronJob(this.entityOf(row))
    const jobKind = this.jobKind()

    if (!target || !cronJob || !jobKind) {
      return
    }

    await this.run(() => this.resourceStore.trigger(target, {
      clusterId: this.clusterId,
      cronJob,
      jobKind,
    }))
  }

  private async setScheduling(row: TResourceRow, cordoned: boolean): Promise<void> {
    const target = this.nodeTargetOf(row)
    if (!target) {
      return
    }

    const changed = await this.run(() => (cordoned
      ? this.nodeStore.cordon(target)
      : this.nodeStore.uncordon(target)))

    if (changed && !this.state.watching) {
      await this.reload()
    }
  }

  private jobKind(): KubeResourceKind | null {
    const slug = KubeResourceRegistry.find('batch', 'jobs')?.slug ?? ''

    return this.discoveryStore.findBySlug(this.clusterId, slug)
        ?? KubeResourceRegistry.find('batch', 'jobs')
        ?? null
  }

  private podsKind(): KubeResourceKind | null {
    return KubeKindLocator.find(this.servedKinds, 'v1', 'Pod')
        ?? KubeResourceRegistry.find('', 'pods')
        ?? null
  }

  private nodeTargetOf(row: TResourceRow | null): TNodeTarget | null {
    const kind = this.kind

    return row && kind
      ? { clusterId: this.clusterId, kind, name: row.name, rowKey: row.key }
      : null
  }

  private resolveCustomColumns(): Promise<void> {
    return this.customKindStore.resolve(this.clusterId, this.kind)
  }

  private async run(action: () => Promise<boolean>): Promise<boolean> {
    this.acting = true
    try {
      return await action()
    } finally {
      this.acting = false
    }
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

  private entityOf(row: TResourceRow | null): RepoEntityBase | null {
    if (!row) {
      return null
    }

    return this.state.items.find(item => ResourceRowBuilder.keyOf(item) === row.key) ?? null
  }

  private targetOf(row: TResourceRow | null): TWorkloadTarget | null {
    const kind = this.kind
    if (!row || !kind) {
      return null
    }

    return { clusterId: this.clusterId, kind, name: row.name, namespace: row.namespace, rowKey: row.key }
  }

  private request(): TResourceListRequest | null {
    const kind = this.kind
    if (!kind || !this.connectionStore.isConnected(this.clusterId)) {
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
    this.sort = null
    this.cursor = null
    this.selected = []
    this.pendingDelete = null
    this.pendingScale = null
    this.pendingDrain = null
    this.creating = false
    this.creatingNamespace = false
    this.detailTab = DetailTabs.overviewKey
    this.hiddenKeys = ResourceColumns.defaultHidden(this.columns)
    this.uiStore.closeDetail()
  }
}
</script>
