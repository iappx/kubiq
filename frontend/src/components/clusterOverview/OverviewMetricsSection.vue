<template>
  <div class="space-y-4">
    <ui-section :description="description" title="Usage">
      <metrics-notice
          v-if="!usageReady"
          :notice="usageNotice"
          :state="usageState"
          settings-path="/app/settings"
      />

      <div v-else class="grid gap-3 sm:grid-cols-2">
        <metrics-usage-bar
            :kind="cpuKind"
            :total="0"
            :used="totals.cpuCores"
            label="CPU across nodes"
            total-label=""
        />
        <metrics-usage-bar
            :kind="memoryKind"
            :total="0"
            :used="totals.memoryBytes"
            label="Memory across nodes"
            total-label=""
        />
      </div>
    </ui-section>

    <metrics-panel :cluster-id="clusterId" :scope="scope" title="History" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import MetricsNotice from '@/components/metrics/MetricsNotice.vue'
import MetricsPanel from '@/components/metrics/MetricsPanel.vue'
import MetricsUsageBar from '@/components/metrics/MetricsUsageBar.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { MetricsNoticeCatalog } from '@/domain/models/metrics'
import type { TMetricScope, TMetricSeriesKind, TMetricsNotice, TMetricsState } from '@/domain/models/metrics'
import { ClusterMetricsStore } from '@/store/modules/clusterMetrics/ClusterMetricsStore'

@Component({
  components: { MetricsNotice, MetricsPanel, MetricsUsageBar, UiSection },
})
export default class OverviewMetricsSection extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  constructor(
      @inject(ClusterMetricsStore) public readonly metricsStore: ClusterMetricsStore,
  ) {
    super()
  }

  public get scope(): TMetricScope {
    return { level: 'cluster' }
  }

  public get usageState(): TMetricsState {
    return this.metricsStore.stateOf(this.clusterId).nodes.state
  }

  public get usageReady(): boolean {
    return MetricsNoticeCatalog.isReady(this.usageState)
  }

  public get usageNotice(): TMetricsNotice {
    return MetricsNoticeCatalog.usage(this.usageState)
  }

  public get description(): string {
    if (!this.usageReady) {
      return 'Live consumption'
    }

    const counted = Object.keys(this.metricsStore.stateOf(this.clusterId).nodes.usage).length

    return `${counted} ${counted === 1 ? 'node' : 'nodes'} reporting`
  }

  public get totals(): TResourceUsage {
    const usage = Object.values(this.metricsStore.stateOf(this.clusterId).nodes.usage)

    return {
      cpuCores: usage.reduce((sum, entry) => sum + entry.cpuCores, 0),
      memoryBytes: usage.reduce((sum, entry) => sum + entry.memoryBytes, 0),
    }
  }

  public get cpuKind(): TMetricSeriesKind {
    return 'cpu'
  }

  public get memoryKind(): TMetricSeriesKind {
    return 'memory'
  }

  async created(): Promise<void> {
    await this.reload()
  }

  @Watch('clusterId')
  async clusterChanged(): Promise<void> {
    await this.reload()
  }

  private reload(): Promise<void> {
    return this.metricsStore.load(this.clusterId, [])
  }
}
</script>
