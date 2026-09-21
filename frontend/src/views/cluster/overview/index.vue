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
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <span v-for="i in 4" :key="i" class="block h-16 rounded-lg shimmer" />
          </div>
          <span class="block h-40 rounded-lg shimmer" />
        </div>
      </template>
    </ui-deferred-loader>

    <div v-else class="flex-1 min-h-0 overflow-auto p-4 space-y-4">
      <section aria-label="Workloads" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
  </div>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { RefreshCw } from '@lucide/vue'
import OverviewEventList from '@/components/clusterOverview/OverviewEventList.vue'
import OverviewNodeHealth from '@/components/clusterOverview/OverviewNodeHealth.vue'
import OverviewWorkloadCard from '@/components/clusterOverview/OverviewWorkloadCard.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ClusterOverviewService } from '@/application/services/clusterOverview/ClusterOverviewService'
import type { TClusterOverview } from '@/application/services/clusterOverview/types/TClusterOverview'
import type { KubeResourceKind } from '@/domain/models/kube'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterOverviewStore } from '@/store/modules/clusterOverview/ClusterOverviewStore'
import type { TClusterOverviewState } from '@/store/modules/clusterOverview/types/TClusterOverviewState'

@Component({
  components: {
    OverviewEventList,
    OverviewNodeHealth,
    OverviewWorkloadCard,
    RefreshCw,
    UiDeferredLoader,
    UiErrorState,
    UiProgressBar,
  },
})
export default class ClusterOverviewPage extends VueBase {
  constructor(
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterDiscoveryStore) public readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterOverviewStore) public readonly overviewStore: ClusterOverviewStore,
  ) {
    super()
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

  async created(): Promise<void> {
    await this.reload()
  }

  @Watch('kinds')
  async kindsChanged(): Promise<void> {
    await this.reload()
  }

  @Watch('namespaces')
  async namespacesChanged(): Promise<void> {
    await this.reload()
  }

  public async reload(): Promise<void> {
    if (!this.connectionStore.isConnected(this.clusterId) || this.kinds.length === 0) {
      return
    }

    await this.overviewStore.load({
      clusterId: this.clusterId,
      kinds: this.kinds,
      namespaces: this.namespaces,
    })
  }

  private pathOf(registryKey: string): string {
    const kind = this.kinds.find(candidate => candidate.registryKey === registryKey)

    return kind ? ClusterRoutes.forKind(this.clusterId, kind) : ''
  }
}
</script>
