<template>
  <div class="flex flex-1 min-w-0 min-h-0 flex-col">
    <div class="ui-toolbar">
      <div class="flex items-baseline gap-2 min-w-0">
        <h2 class="text-sm font-semibold text-foreground truncate">Overview</h2>
        <span class="text-xs text-muted-foreground truncate">{{ scopeLabel }}</span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
            :disabled="state.loading"
            aria-label="Reload the overview"
            class="btn-icon w-7 h-7"
            title="Reload the overview"
            type="button"
            @click="reload"
        >
          <refresh-cw :class="state.loading ? 'animate-spin' : ''" :size="14" />
        </button>
      </div>
    </div>

    <ui-progress-bar v-if="state.loading && state.loaded" label="Refreshing the overview" />

    <ui-error-state
        v-if="state.error"
        :detail="state.errorDetail"
        :message="state.error"
        title="Could not read this cluster"
        @retry="reload"
    />

    <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
      <template #loading>
        <div aria-hidden="true" class="p-4 space-y-4">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <span v-for="i in 8" :key="i" class="block h-20 rounded-lg shimmer" />
          </div>
          <span class="block h-40 rounded-lg shimmer" />
        </div>
      </template>
    </ui-deferred-loader>

    <div v-else class="flex-1 min-h-0 overflow-auto p-4">
      <ui-tab-bar :active="activeTab" :tabs="tabs" @change="selectTab" />

      <div v-if="activeTab === 'health'" class="space-y-4">
        <section aria-label="Cluster health" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <overview-workload-card
              v-for="summary in overview.workloads"
              :key="summary.kindKey"
              :cluster-id="clusterId"
              :summary="summary"
          />
        </section>

        <div class="grid gap-4 xl:grid-cols-2">
          <overview-node-health :health="overview.nodes" :path="nodesPath" />
          <overview-event-list :error="overview.eventsError" :events="overview.events" :path="eventsPath" />
        </div>
      </div>

      <div v-else class="space-y-4">
        <overview-allocation-card
            :capacity="overview.capacity"
            :cluster-id="clusterId"
            :node-usage="nodeUsage"
            :usage-state="nodeUsageState"
        />

        <overview-efficiency-table
            :cluster-id="clusterId"
            :pod-kind="podKind"
            :pod-usage="podUsage"
            :pods="overview.pods"
            :usage-state="podUsageState"
        />

        <overview-metrics-section :cluster-id="clusterId" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { RefreshCw } from '@lucide/vue'
import OverviewAllocationCard from '@/components/clusterOverview/OverviewAllocationCard.vue'
import OverviewEfficiencyTable from '@/components/clusterOverview/OverviewEfficiencyTable.vue'
import OverviewEventList from '@/components/clusterOverview/OverviewEventList.vue'
import OverviewMetricsSection from '@/components/clusterOverview/OverviewMetricsSection.vue'
import OverviewNodeHealth from '@/components/clusterOverview/OverviewNodeHealth.vue'
import OverviewWorkloadCard from '@/components/clusterOverview/OverviewWorkloadCard.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ClusterOverviewService } from '@/application/services/clusterOverview/ClusterOverviewService'
import type { TClusterOverview } from '@/application/services/clusterOverview/types/TClusterOverview'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { AppResumedEvent } from '@/domain/events/app/AppResumedEvent'
import { KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TMetricsState } from '@/domain/models/metrics'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterMetricsStore } from '@/store/modules/clusterMetrics/ClusterMetricsStore'
import { ClusterOverviewStore } from '@/store/modules/clusterOverview/ClusterOverviewStore'
import type { TClusterOverviewState } from '@/store/modules/clusterOverview/types/TClusterOverviewState'

@Component({
  components: {
    OverviewAllocationCard,
    OverviewEfficiencyTable,
    OverviewEventList,
    OverviewMetricsSection,
    OverviewNodeHealth,
    OverviewWorkloadCard,
    RefreshCw,
    UiDeferredLoader,
    UiErrorState,
    UiProgressBar,
    UiTabBar,
  },
})
export default class ClusterOverviewPage extends VueBase {
  public activeTab: string = 'health'

  private onResumed!: () => void

  private onConnectivity!: (event: AppConnectivityEvent) => void

  constructor(
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterDiscoveryStore) public readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterMetricsStore) public readonly metricsStore: ClusterMetricsStore,
      @inject(ClusterOverviewStore) public readonly overviewStore: ClusterOverviewStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get tabs(): TTab[] {
    return [
      { key: 'health', label: 'Health' },
      { key: 'resources', label: 'Resources' },
    ]
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public get state(): TClusterOverviewState {
    return this.overviewStore.stateOf(this.clusterId)
  }

  public get overview(): TClusterOverview {
    return this.state.overview
  }

  public get kinds(): KubeResourceKind[] {
    return this.discoveryStore.kindsOf(this.clusterId)
  }

  public get namespaces(): string[] {
    return this.connectionStore.namespacesOf(this.clusterId)
  }

  public get scopeLabel(): string {
    if (this.namespaces.length === 0) {
      return 'Every namespace'
    }

    return this.namespaces.length === 1
        ? this.namespaces[0]
        : `${this.namespaces.length} selected namespaces`
  }

  public get showSkeleton(): boolean {
    return this.state.loading && !this.state.loaded
  }

  public get nodesPath(): string {
    return this.pathOf(ClusterOverviewService.nodesKey)
  }

  public get eventsPath(): string {
    return this.pathOf(ClusterOverviewService.eventsKey)
  }

  public get podKind(): KubeResourceKind | null {
    return this.kinds.find(candidate => candidate.registryKey === KubeWorkloadCatalog.podsKey) ?? null
  }

  public get nodeUsage(): Record<string, TResourceUsage> {
    return this.metricsStore.stateOf(this.clusterId).nodes.usage
  }

  public get nodeUsageState(): TMetricsState {
    return this.metricsStore.stateOf(this.clusterId).nodes.state
  }

  public get podUsage(): Record<string, TResourceUsage> {
    return this.metricsStore.stateOf(this.clusterId).pods.usage
  }

  public get podUsageState(): TMetricsState {
    return this.metricsStore.stateOf(this.clusterId).pods.state
  }

  async created(): Promise<void> {
    this.onResumed = () => void this.reload()
    this.onConnectivity = (event: AppConnectivityEvent) => {
      if (event.online) {
        void this.reload()
      }
    }
    this.eventBus.registerHandler(AppResumedEvent, this.onResumed)
    this.eventBus.registerHandler(AppConnectivityEvent, this.onConnectivity)

    await this.reload()
  }

  beforeUnmount(): void {
    this.eventBus.unregisterHandler(AppResumedEvent, this.onResumed)
    this.eventBus.unregisterHandler(AppConnectivityEvent, this.onConnectivity)
  }

  @Watch('kinds')
  async kindsChanged(): Promise<void> {
    await this.reload()
  }

  @Watch('namespaces')
  async namespacesChanged(): Promise<void> {
    await this.reload()
  }

  public selectTab(tab: string): void {
    this.activeTab = tab
  }

  public async reload(): Promise<void> {
    if (!this.connectionStore.isConnected(this.clusterId) || this.kinds.length === 0) {
      return
    }

    await Promise.all([
      this.overviewStore.load({
        clusterId: this.clusterId,
        kinds: this.kinds,
        namespaces: this.namespaces,
      }),
      this.metricsStore.load(this.clusterId, this.namespaces),
    ])
  }

  private pathOf(registryKey: string): string {
    const kind = this.kinds.find(candidate => candidate.registryKey === registryKey)

    return kind ? ClusterRoutes.forKind(this.clusterId, kind) : ''
  }
}
</script>
