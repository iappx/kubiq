<template>
  <div>
    <button
        :aria-expanded="expanded"
        class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
        type="button"
        @click="$emit('toggle')"
    >
      <chevron-down v-if="expanded" :size="14" class="text-muted-foreground shrink-0" />
      <chevron-right v-else :size="14" class="text-muted-foreground shrink-0" />

      <span class="text-xs font-medium text-foreground truncate">{{ group.namespace }}</span>
      <span class="pill tabular">{{ podLabel }}</span>

      <span class="ml-auto flex items-center gap-3 text-xs tabular text-muted-foreground shrink-0">
        <span>CPU {{ formatCores(group.totalCpuUsedCores) }} · {{ formatPercent(group.maxCpuRatio) }}</span>
        <span>Mem {{ formatBytes(group.totalMemoryUsedBytes) }} · {{ formatPercent(group.maxMemoryRatio) }}</span>
      </span>
    </button>

    <ul v-if="expanded" class="divide-y divide-border border-t border-border bg-background/50">
      <li
          v-for="item in group.items"
          :key="item.key"
          class="grid gap-3 px-4 py-2 sm:grid-cols-12 items-center"
      >
        <div class="sm:col-span-4 min-w-0">
          <button
              :title="labelOf(item)"
              class="ui-name-button text-xs truncate max-w-full block"
              type="button"
              @click="$emit('select', item)"
          >
            {{ labelOf(item) }}
          </button>
        </div>

        <div class="sm:col-span-4 space-y-1 min-w-0">
          <div class="flex items-baseline justify-between gap-2 text-xs tabular">
            <span class="text-muted-foreground">CPU {{ cpuSummary(item) }}</span>
            <span :class="ratioClass(item.cpuRatio)">{{ ratioLabel(item.cpuRatio, cpuBase(item)) }}</span>
          </div>
          <div v-if="cpuBase(item) > 0" class="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div :class="barClass(item.cpuRatio)" :style="{ width: barWidth(item.cpuRatio) }" class="h-1 rounded-full" />
          </div>
        </div>

        <div class="sm:col-span-4 space-y-1 min-w-0">
          <div class="flex items-baseline justify-between gap-2 text-xs tabular">
            <span class="text-muted-foreground">Mem {{ memorySummary(item) }}</span>
            <span :class="ratioClass(item.memoryRatio)">{{ ratioLabel(item.memoryRatio, memoryBase(item)) }}</span>
          </div>
          <div v-if="memoryBase(item) > 0" class="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div :class="barClass(item.memoryRatio)" :style="{ width: barWidth(item.memoryRatio) }" class="h-1 rounded-full" />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { MetricFormat } from '@/domain/models/metrics'
import type { TEfficiencyItem, TEfficiencyMode, TEfficiencyNamespaceGroup } from '@/domain/models/metrics'

@Component({
  components: { ChevronDown, ChevronRight },
  emits: ['toggle', 'select'],
})
export default class OverviewEfficiencyGroupRow extends VueBase {
  @Prop({ required: true })
  public readonly group: TEfficiencyNamespaceGroup

  @Prop({ required: true })
  public readonly mode: TEfficiencyMode

  @Prop({ required: true })
  public readonly expanded: boolean

  public get podLabel(): string {
    return `${this.group.podCount} ${this.group.podCount === 1 ? 'pod' : 'pods'}`
  }

  public labelOf(item: TEfficiencyItem): string {
    return item.containerName ? `${item.podName} / ${item.containerName}` : item.podName
  }

  public cpuBase(item: TEfficiencyItem): number {
    return this.mode === 'near-limit' ? item.cpuLimitCores : item.cpuRequestCores
  }

  public memoryBase(item: TEfficiencyItem): number {
    return this.mode === 'near-limit' ? item.memoryLimitBytes : item.memoryRequestBytes
  }

  public cpuSummary(item: TEfficiencyItem): string {
    const base = this.cpuBase(item)

    return base > 0
        ? `${MetricFormat.cores(item.cpuUsedCores)} / ${MetricFormat.cores(base)}`
        : MetricFormat.cores(item.cpuUsedCores)
  }

  public memorySummary(item: TEfficiencyItem): string {
    const base = this.memoryBase(item)

    return base > 0
        ? `${MetricFormat.bytes(item.memoryUsedBytes)} / ${MetricFormat.bytes(base)}`
        : MetricFormat.bytes(item.memoryUsedBytes)
  }

  public ratioLabel(ratio: number, base: number): string {
    return base > 0 ? MetricFormat.percent(ratio) : '—'
  }

  public barWidth(ratio: number): string {
    return `${Math.min(100, Math.round(ratio * 100))}%`
  }

  public ratioClass(ratio: number): string {
    if (this.mode === 'unused-requests') {
      return 'text-muted-foreground'
    }
    if (ratio >= 1.5 || (this.mode === 'near-limit' && ratio >= 0.9)) {
      return 'text-destructive font-medium'
    }

    return ratio >= 0.8 ? 'text-warning font-medium' : 'text-foreground'
  }

  public barClass(ratio: number): string {
    if (this.mode === 'unused-requests') {
      return 'bg-primary'
    }
    if (ratio >= 1.5 || (this.mode === 'near-limit' && ratio >= 0.9)) {
      return 'bg-destructive'
    }

    return ratio >= 0.8 ? 'bg-warning' : 'bg-primary'
  }

  public formatCores(value: number): string {
    return MetricFormat.cores(value)
  }

  public formatBytes(value: number): string {
    return MetricFormat.bytes(value)
  }

  public formatPercent(ratio: number): string {
    return MetricFormat.percent(ratio)
  }
}
</script>
