<template>
  <ui-section description="Running pods compared against their configured requests and limits" title="Workload efficiency">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1">
          <button
              v-for="tab in modes"
              :key="tab.key"
              :class="['pill', mode === tab.key ? 'pill-active' : '']"
              type="button"
              @click="selectMode(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <span class="text-xs text-muted-foreground mr-1">Threshold</span>
          <button
              v-for="value in thresholds"
              :key="value"
              :class="['pill tabular', threshold === value ? 'pill-active' : '']"
              type="button"
              @click="selectThreshold(value)"
          >
            {{ value }}%
          </button>
        </div>
      </div>

      <metrics-notice
          v-if="!usageReady"
          :notice="usageNotice"
          :state="usageState"
          settings-path="/app/settings"
      />

      <p v-else-if="groups.length === 0" class="text-sm text-muted-foreground">
        No running workloads match this threshold.
      </p>

      <div v-else class="divide-y divide-border rounded-md border border-border">
        <overview-efficiency-group-row
            v-for="(group, index) in groups"
            :key="group.namespace"
            :expanded="isExpanded(group.namespace, index)"
            :group="group"
            :mode="mode"
            @select="openPod"
            @toggle="toggleGroup(group.namespace, index)"
        />
      </div>
    </div>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import OverviewEfficiencyGroupRow from '@/components/clusterOverview/OverviewEfficiencyGroupRow.vue'
import MetricsNotice from '@/components/metrics/MetricsNotice.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import type { PodEntity } from '@/domain/entities/workloads'
import { OpenClusterObjectEvent } from '@/domain/events/cluster/OpenClusterObjectEvent'
import type { KubeResourceKind } from '@/domain/models/kube'
import { MetricsNoticeCatalog, WorkloadEfficiencyAnalyzer } from '@/domain/models/metrics'
import type {
  TEfficiencyItem,
  TEfficiencyMode,
  TEfficiencyNamespaceGroup,
  TMetricsNotice,
  TMetricsState,
} from '@/domain/models/metrics'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@Component({
  components: { MetricsNotice, OverviewEfficiencyGroupRow, UiSection },
})
export default class OverviewEfficiencyTable extends VueBase {
  public static readonly defaultOpenCount: number = 3

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly pods: PodEntity[]

  @Prop({ required: true })
  public readonly podUsage: Record<string, TResourceUsage>

  @Prop({ required: true })
  public readonly usageState: TMetricsState

  @Prop({ required: false, default: null })
  public readonly podKind?: KubeResourceKind | null

  public mode: TEfficiencyMode = 'over-request'

  public threshold: number = WorkloadEfficiencyAnalyzer.defaultThreshold('over-request')

  public toggled: Record<string, boolean> = {}

  constructor(
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get modes(): { key: TEfficiencyMode; label: string }[] {
    return [
      { key: 'near-limit', label: 'Near limit' },
      { key: 'over-request', label: 'Over request' },
      { key: 'unused-requests', label: 'Unused requests' },
    ]
  }

  public get thresholds(): readonly number[] {
    return WorkloadEfficiencyAnalyzer.thresholdsOf(this.mode)
  }

  public get usageReady(): boolean {
    return MetricsNoticeCatalog.isReady(this.usageState)
  }

  public get usageNotice(): TMetricsNotice {
    return MetricsNoticeCatalog.usage(this.usageState)
  }

  public get groups(): TEfficiencyNamespaceGroup[] {
    if (!this.usageReady) {
      return []
    }

    return WorkloadEfficiencyAnalyzer.analyze(this.pods, this.podUsage, this.mode, this.threshold)
  }

  public selectMode(mode: TEfficiencyMode): void {
    this.mode = mode
    this.threshold = WorkloadEfficiencyAnalyzer.defaultThreshold(mode)
    this.toggled = {}
  }

  public selectThreshold(value: number): void {
    this.threshold = value
  }

  public isExpanded(namespace: string, index: number): boolean {
    if (Object.prototype.hasOwnProperty.call(this.toggled, namespace)) {
      return this.toggled[namespace]
    }

    return index < OverviewEfficiencyTable.defaultOpenCount
  }

  public toggleGroup(namespace: string, index: number): void {
    this.toggled = { ...this.toggled, [namespace]: !this.isExpanded(namespace, index) }
  }

  public openPod(item: TEfficiencyItem): void {
    if (!this.podKind) {
      return
    }

    this.eventBus.emitEvent(new OpenClusterObjectEvent(this.clusterId, this.podKind, item.namespace, item.podName))
  }
}
</script>
