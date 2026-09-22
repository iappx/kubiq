<template>
  <div class="space-y-4">
    <resource-section v-if="showUsage" :hint="usageHint" title="Current usage">
      <metrics-notice
          v-if="!usageReady"
          :notice="usageNotice"
          :state="usageState"
          settings-path="/app/settings"
      />

      <div v-else class="space-y-3">
        <metrics-usage-bar
            :kind="cpuKind"
            :total="allowance.cpu.limit || allowance.cpu.request"
            :total-label="allowanceLabel(allowance.cpu.limit > 0)"
            :used="usage.cpuCores"
            label="CPU"
        />
        <metrics-usage-bar
            :kind="memoryKind"
            :total="allowance.memory.limit || allowance.memory.request"
            :total-label="allowanceLabel(allowance.memory.limit > 0)"
            :used="usage.memoryBytes"
            label="Memory"
        />
      </div>
    </resource-section>

    <metrics-panel
        :cluster-id="target.clusterId"
        :height="150"
        :scope="scope"
        title="History"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import MetricsNotice from '@/components/metrics/MetricsNotice.vue'
import MetricsPanel from '@/components/metrics/MetricsPanel.vue'
import MetricsUsageBar from '@/components/metrics/MetricsUsageBar.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { MetricsScope } from '@/components/metrics/MetricsScope'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { MetricLevelCatalog, MetricsAllowance, MetricsNoticeCatalog } from '@/domain/models/metrics'
import type {
    TMetricScope,
    TMetricSeriesKind,
    TMetricsAllowance,
    TMetricsNotice,
    TMetricsState,
} from '@/domain/models/metrics'
import { ClusterMetricsStore } from '@/store/modules/clusterMetrics/ClusterMetricsStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'

@Component({
  components: { MetricsNotice, MetricsPanel, MetricsUsageBar, ResourceSection },
})
export default class ResourceMetricsSection extends VueBase {
  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  @Prop({ required: true })
  public readonly object: Record<string, unknown>

  constructor(
      @inject(ClusterMetricsStore) public readonly metricsStore: ClusterMetricsStore,
  ) {
    super()
  }

  public get scope(): TMetricScope {
    return MetricsScope.of(this.target.kind, this.target.namespace, this.target.name)
  }

  public get showUsage(): boolean {
    return MetricsScope.supportsUsage(this.target.kind)
  }

  public get isPod(): boolean {
    return this.scope.level === 'pod'
  }

  public get usage(): TResourceUsage {
    const found = this.isPod
        ? this.metricsStore.podUsage(this.target.clusterId, this.target.namespace, this.target.name)
        : this.metricsStore.nodeUsage(this.target.clusterId, this.target.name)

    return found ?? { cpuCores: 0, memoryBytes: 0 }
  }

  public get usageState(): TMetricsState {
    const state = this.metricsStore.stateOf(this.target.clusterId)

    return this.isPod ? state.pods.state : state.nodes.state
  }

  public get usageReady(): boolean {
    return MetricsNoticeCatalog.isReady(this.usageState)
  }

  public get usageNotice(): TMetricsNotice {
    return MetricsNoticeCatalog.usage(this.usageState)
  }

  public get usageHint(): string {
    return this.usageReady ? 'From metrics.k8s.io' : ''
  }

  public get allowance(): TMetricsAllowance {
    return this.isPod ? MetricsAllowance.ofPod(this.object) : MetricsAllowance.ofNode(this.object)
  }

  public get cpuKind(): TMetricSeriesKind {
    return 'cpu'
  }

  public get memoryKind(): TMetricSeriesKind {
    return 'memory'
  }

  // The panel is handed a fresh reference whenever the list re-renders, so the
  // watcher keys off what identifies the object rather than off the object.
  public get targetKey(): string {
    return MetricLevelCatalog.keyOf(this.scope)
  }

  async created(): Promise<void> {
    await this.reload()
  }

  @Watch('targetKey')
  async targetChanged(): Promise<void> {
    await this.reload()
  }

  public allowanceLabel(hasLimit: boolean): string {
    if (this.isPod) {
      return hasLimit ? 'limit' : 'requests'
    }

    return hasLimit ? 'capacity' : 'allocatable'
  }

  private reload(): Promise<void> {
    if (!this.showUsage) {
      return Promise.resolve()
    }

    return this.metricsStore.load(
      this.target.clusterId,
      this.isPod && this.target.namespace ? [this.target.namespace] : [],
    )
  }
}
</script>
