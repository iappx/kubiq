<template>
  <ui-section :description="description" title="Capacity and allocation">
    <template #actions>
      <button
          aria-label="Open local shell"
          class="btn-icon w-7 h-7"
          title="Open local shell"
          type="button"
          @click="openLocalShell"
      >
        <terminal :size="14" />
      </button>
    </template>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-3">
        <p class="text-xs font-medium text-muted-foreground">Usage of capacity</p>

        <metrics-notice
            v-if="!usageReady"
            :notice="usageNotice"
            :state="usageState"
            settings-path="/app/settings"
        />

        <div v-else class="space-y-3">
          <metrics-usage-bar
              :kind="cpuKind"
              :total="capacity.cpuCapacityCores"
              :used="usedCpuCores"
              label="CPU"
              total-label="capacity"
          />
          <metrics-usage-bar
              :kind="memoryKind"
              :total="capacity.memoryCapacityBytes"
              :used="usedMemoryBytes"
              label="Memory"
              total-label="capacity"
          />
        </div>
      </div>

      <div class="space-y-3">
        <p class="text-xs font-medium text-muted-foreground">Allocation of allocatable</p>

        <metrics-usage-bar
            :kind="cpuKind"
            :total="capacity.cpuAllocatableCores"
            :used="capacity.cpuRequestedCores"
            label="CPU requests"
            total-label="allocatable"
        />
        <metrics-usage-bar
            :kind="memoryKind"
            :total="capacity.memoryAllocatableBytes"
            :used="capacity.memoryRequestedBytes"
            label="Memory requests"
            total-label="allocatable"
        />

        <div class="space-y-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-xs text-muted-foreground">Pods</span>
            <span class="text-xs tabular text-foreground">{{ podsSummary }}</span>
          </div>
          <div
              v-if="capacity.podsAllocatable > 0"
              :aria-label="`Pods: ${podsSummary}`"
              class="h-1.5 w-full rounded-full bg-muted"
              role="img"
          >
            <div :class="podsToneClass" :style="{ width: podsWidth }" class="h-1.5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Terminal } from '@lucide/vue'
import MetricsNotice from '@/components/metrics/MetricsNotice.vue'
import MetricsUsageBar from '@/components/metrics/MetricsUsageBar.vue'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { OpenLocalShellEvent } from '@/domain/events/terminal/OpenLocalShellEvent'
import { MetricFormat, MetricQuantity, MetricsNoticeCatalog } from '@/domain/models/metrics'
import type { TClusterCapacitySummary, TMetricSeriesKind, TMetricsNotice, TMetricsState } from '@/domain/models/metrics'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@Component({
  components: { MetricsNotice, MetricsUsageBar, Terminal, UiSection },
})
export default class OverviewAllocationCard extends VueBase {
  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly capacity: TClusterCapacitySummary

  @Prop({ required: true })
  public readonly nodeUsage: Record<string, TResourceUsage>

  @Prop({ required: true })
  public readonly usageState: TMetricsState

  constructor(
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get usageReady(): boolean {
    return MetricsNoticeCatalog.isReady(this.usageState)
  }

  public get usageNotice(): TMetricsNotice {
    return MetricsNoticeCatalog.usage(this.usageState)
  }

  public get description(): string {
    const count = this.capacity.nodeCount

    return `${count} ${count === 1 ? 'node' : 'nodes'} in cluster`
  }

  public get usedCpuCores(): number {
    return Object.values(this.nodeUsage).reduce((sum, entry) => sum + entry.cpuCores, 0)
  }

  public get usedMemoryBytes(): number {
    return Object.values(this.nodeUsage).reduce((sum, entry) => sum + entry.memoryBytes, 0)
  }

  public get podsRatio(): number {
    return MetricQuantity.ratio(this.capacity.podsAllocated, this.capacity.podsAllocatable)
  }

  public get podsWidth(): string {
    return `${Math.min(100, Math.round(this.podsRatio * 100))}%`
  }

  public get podsSummary(): string {
    if (this.capacity.podsAllocatable <= 0) {
      return String(this.capacity.podsAllocated)
    }

    return `${this.capacity.podsAllocated} / ${this.capacity.podsAllocatable} allocatable · ${MetricFormat.percent(this.podsRatio)}`
  }

  public get podsToneClass(): string {
    if (this.podsRatio >= 1) {
      return 'bg-destructive'
    }

    return this.podsRatio >= MetricsUsageBar.warningRatio ? 'bg-warning' : 'bg-primary'
  }

  public get cpuKind(): TMetricSeriesKind {
    return 'cpu'
  }

  public get memoryKind(): TMetricSeriesKind {
    return 'memory'
  }

  public openLocalShell(): void {
    this.eventBus.emitEvent(new OpenLocalShellEvent(this.clusterId))
  }
}
</script>
