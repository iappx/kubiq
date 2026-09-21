<template>
  <ui-section :description="subject" :title="title">
    <template #actions>
      <div class="flex items-center gap-2">
        <metrics-range-picker :range="chartStore.range" @update:range="setRange" />
        <button
            :disabled="busy"
            aria-label="Reload the charts"
            class="btn-icon w-7 h-7"
            title="Reload the charts"
            type="button"
            @click="reload"
        >
          <refresh-cw :class="busy ? 'animate-spin' : ''" :size="14" />
        </button>
      </div>
    </template>

    <metrics-notice
        v-if="!isReady"
        :notice="notice"
        :settings-path="settingsPath"
        :state="target.state"
    />

    <div v-else class="grid gap-3 lg:grid-cols-2">
      <metrics-chart-card
          :height="height"
          :kind="cpuKind"
          :state="cpuState"
          title="CPU"
          @retry="load"
      />
      <metrics-chart-card
          :height="height"
          :kind="memoryKind"
          :state="memoryState"
          title="Memory"
          @retry="load"
      />
    </div>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { RefreshCw } from '@lucide/vue'
import MetricsChartCard from '@/components/metrics/MetricsChartCard.vue'
import MetricsNotice from '@/components/metrics/MetricsNotice.vue'
import MetricsRangePicker from '@/components/metrics/MetricsRangePicker.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { MetricLevelCatalog, MetricsNoticeCatalog } from '@/domain/models/metrics'
import type { TMetricRangeId, TMetricScope, TMetricSeriesKind, TMetricsNotice } from '@/domain/models/metrics'
import { MetricsChartStore } from '@/store/modules/metricsChart/MetricsChartStore'
import type { TMetricsChartState } from '@/store/modules/metricsChart/types/TMetricsChartState'
import type { TPrometheusTargetState } from '@/store/modules/metricsChart/types/TPrometheusTargetState'

@Component({
  components: { MetricsChartCard, MetricsNotice, MetricsRangePicker, RefreshCw, UiSection },
})
export default class MetricsPanel extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly scope: TMetricScope

  @Prop({ required: false, default: 'Metrics' })
  public readonly title: string

  @Prop({ required: false, default: 160 })
  public readonly height: number

  constructor(
      @inject(MetricsChartStore) public readonly chartStore: MetricsChartStore,
  ) {
    super()
  }

  public get target(): TPrometheusTargetState {
    return this.chartStore.targetOf(this.clusterId)
  }

  public get isReady(): boolean {
    return MetricsNoticeCatalog.isReady(this.target.state) && this.target.loaded
  }

  public get notice(): TMetricsNotice {
    return MetricsNoticeCatalog.history(this.target.state)
  }

  public get subject(): string {
    return MetricLevelCatalog.subjectOf(this.scope)
  }

  public get cpuKind(): TMetricSeriesKind {
    return 'cpu'
  }

  public get memoryKind(): TMetricSeriesKind {
    return 'memory'
  }

  public get cpuState(): TMetricsChartState {
    return this.chartStore.chartOf({ clusterId: this.clusterId, scope: this.scope, kind: 'cpu' })
  }

  public get memoryState(): TMetricsChartState {
    return this.chartStore.chartOf({ clusterId: this.clusterId, scope: this.scope, kind: 'memory' })
  }

  public get busy(): boolean {
    return this.target.loading || this.cpuState.loading || this.memoryState.loading
  }

  public get settingsPath(): string {
    return ClusterRoutes.settings
  }

  public get scopeKey(): string {
    return MetricLevelCatalog.keyOf(this.scope)
  }

  async created(): Promise<void> {
    await this.reload()
  }

  @Watch('clusterId')
  async clusterChanged(): Promise<void> {
    await this.reload()
  }

  @Watch('scopeKey')
  async scopeChanged(): Promise<void> {
    await this.load()
  }

  public async setRange(range: TMetricRangeId): Promise<void> {
    this.chartStore.setRange(range)
    await this.load()
  }

  public async reload(): Promise<void> {
    await this.chartStore.resolveOnce(this.clusterId)
    await this.load()
  }

  public async load(): Promise<void> {
    if (!this.isReady) {
      return
    }

    await Promise.all([
      this.chartStore.load({ clusterId: this.clusterId, scope: this.scope, kind: 'cpu' }),
      this.chartStore.load({ clusterId: this.clusterId, scope: this.scope, kind: 'memory' }),
    ])
  }
}
</script>
