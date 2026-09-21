<template>
  <figure class="ui-chart">
    <figcaption class="sr-only">{{ label }}</figcaption>
    <div ref="host" class="ui-chart-host" />
    <ul v-if="series.length > 1" class="ui-chart-legend">
      <li v-for="(entry, index) in series" :key="entry.key" class="ui-chart-legend-item">
        <span :style="{ backgroundColor: colourAt(index) }" aria-hidden="true" class="ui-chart-swatch" />
        <span :title="entry.label" class="truncate">{{ entry.label }}</span>
      </li>
    </ul>
  </figure>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import type uPlot from 'uplot'
import { ChartService } from '@/application/services/chart/ChartService'
import { ChartTheme } from '@/application/services/chart/models/ChartTheme'
import type { TChartTheme } from '@/application/services/chart/types/TChartTheme'
import { ChartAxisScale } from '@/components/chart/ChartAxisScale'
import { ChartDataBuilder } from '@/components/chart/ChartDataBuilder'
import { MetricFormat } from '@/domain/models/metrics'
import type { TMetricSeries, TMetricSeriesKind } from '@/domain/models/metrics'

@Component({})
export default class UiTimeChart extends VueBase {
  @Prop({ required: true })
  public readonly series: TMetricSeries[]

  @Prop({ required: true })
  public readonly unit: TMetricSeriesKind

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: 180 })
  public readonly height: number

  private chart: uPlot | null = null

  private observer: ResizeObserver | null = null

  private theme: TChartTheme | null = null

  constructor(
      @inject(ChartService) private readonly chartService: ChartService,
  ) {
    super()
  }

  async mounted(): Promise<void> {
    await this.build()
  }

  beforeUnmount(): void {
    this.teardown()
  }

  @Watch('series')
  seriesChanged(): void {
    void this.build()
  }

  @Watch('unit')
  unitChanged(): void {
    void this.build()
  }

  public colourAt(index: number): string {
    return this.theme ? ChartTheme.colourAt(this.theme, index) : 'transparent'
  }

  private async build(): Promise<void> {
    const host = this.$refs.host as HTMLElement | undefined
    if (!host) {
      return
    }

    const api = await this.chartService.load()
    const stillMounted = this.$refs.host as HTMLElement | undefined
    if (!stillMounted) {
      return
    }

    this.teardown()
    this.theme = this.chartService.theme()
    this.chart = new api(this.options(stillMounted.clientWidth || 320), ChartDataBuilder.align(this.series), stillMounted)
    this.observe(stillMounted)
  }

  private options(width: number): uPlot.Options {
    const theme = this.theme as TChartTheme
    const unit = this.unit

    return {
      width,
      height: this.height,
      padding: [8, 8, 0, 0],
      legend: { show: false },
      cursor: { y: false, points: { size: 5 } },
      scales: { x: { time: true } },
      axes: [
        {
          stroke: theme.axis,
          grid: { stroke: theme.grid, width: 1 },
          ticks: { stroke: theme.grid, width: 1 },
          font: `11px ${theme.font}`,
        },
        {
          stroke: theme.axis,
          grid: { stroke: theme.grid, width: 1 },
          ticks: { stroke: theme.grid, width: 1 },
          font: `11px ${theme.font}`,
          size: 56,
          values: (_self, ticks) => ticks.map(tick => MetricFormat.of(unit, tick)),
        },
      ],
      series: [
        { value: (_self, raw) => ChartAxisScale.timeLabel(raw) },
        ...this.series.map((entry, index) => ({
          label: entry.label,
          stroke: ChartTheme.colourAt(theme, index),
          width: 1.5,
          points: { show: false },
          value: (_self: uPlot, raw: number | null) => MetricFormat.of(unit, raw ?? 0),
        })),
      ],
    }
  }

  private observe(host: HTMLElement): void {
    if (typeof ResizeObserver !== 'function') {
      return
    }

    this.observer = new ResizeObserver(() => this.resize(host))
    this.observer.observe(host)
  }

  private resize(host: HTMLElement): void {
    if (this.chart && host.clientWidth > 0) {
      this.chart.setSize({ width: host.clientWidth, height: this.height })
    }
  }

  private teardown(): void {
    this.observer?.disconnect()
    this.observer = null
    this.chart?.destroy()
    this.chart = null
  }
}
</script>

<style scoped>
/* uPlot builds its own DOM, so its structural rules live here instead of the
   stylesheet the package ships — the colours have to come from the tokens. */
.ui-chart-host {
  width: 100%;
}

.ui-chart-host :deep(.u-wrap) {
  position: relative;
  user-select: none;
}

.ui-chart-host :deep(.u-over),
.ui-chart-host :deep(.u-under) {
  position: absolute;
}

.ui-chart-host :deep(.u-under) {
  overflow: hidden;
}

.ui-chart-host :deep(.u-over) {
  z-index: 1;
}

.ui-chart-host :deep(.u-axis) {
  position: absolute;
}

.ui-chart-host :deep(.u-cursor-x),
.ui-chart-host :deep(.u-cursor-y) {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  will-change: transform;
  z-index: 100;
}

.ui-chart-host :deep(.u-hz .u-cursor-x) {
  height: 100%;
  border-right: 1px dashed hsl(var(--border));
}

.ui-chart-host :deep(.u-hz .u-cursor-y) {
  width: 100%;
  border-bottom: 1px dashed hsl(var(--border));
}

.ui-chart-host :deep(.u-cursor-pt) {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50%;
  border: 1px solid hsl(var(--background));
  pointer-events: none;
  will-change: transform;
  z-index: 100;
}

.ui-chart-host :deep(.u-select) {
  position: absolute;
  background: hsl(var(--primary) / 0.12);
  pointer-events: none;
}

.ui-chart-host :deep(.u-cursor-pt),
.ui-chart-host :deep(.u-cursor-x),
.ui-chart-host :deep(.u-cursor-y),
.ui-chart-host :deep(.u-select) {
  display: none;
}

.ui-chart-host :deep(.u-over:hover ~ * .u-cursor-pt),
.ui-chart-host :deep(.u-wrap:hover .u-cursor-pt),
.ui-chart-host :deep(.u-wrap:hover .u-cursor-x),
.ui-chart-host :deep(.u-wrap:hover .u-cursor-y) {
  display: block;
}

.ui-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 8px;
}

.ui-chart-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 180px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ui-chart-swatch {
  width: 8px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
}
</style>
