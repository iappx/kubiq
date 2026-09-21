<template>
  <div class="space-y-1">
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-xs text-muted-foreground">{{ label }}</span>
      <span class="text-xs tabular text-foreground">{{ summary }}</span>
    </div>

    <div v-if="total > 0" :aria-label="ariaLabel" class="h-1.5 w-full rounded-full bg-muted" role="img">
      <div :class="toneClass" :style="{ width: width }" class="h-1.5 rounded-full" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { MetricFormat, MetricQuantity } from '@/domain/models/metrics'
import type { TMetricSeriesKind } from '@/domain/models/metrics'

@Component({})
export default class MetricsUsageBar extends VueBase {
  public static readonly warningRatio: number = 0.8

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly used: number

  @Prop({ required: true })
  public readonly total: number

  @Prop({ required: true })
  public readonly totalLabel: string

  @Prop({ required: true })
  public readonly kind: TMetricSeriesKind

  public get ratio(): number {
    return MetricQuantity.ratio(this.used, this.total)
  }

  public get width(): string {
    return `${Math.min(100, Math.round(this.ratio * 100))}%`
  }

  public get summary(): string {
    const used = MetricFormat.of(this.kind, this.used)
    if (this.total <= 0) {
      return used
    }

    return `${used} / ${MetricFormat.of(this.kind, this.total)} ${this.totalLabel} · ${MetricFormat.percent(this.ratio)}`
  }

  public get ariaLabel(): string {
    return `${this.label}: ${this.summary}`
  }

  public get toneClass(): string {
    if (this.ratio >= 1) {
      return 'bg-destructive'
    }

    return this.ratio >= MetricsUsageBar.warningRatio ? 'bg-warning' : 'bg-primary'
  }
}
</script>
