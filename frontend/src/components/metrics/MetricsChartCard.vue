<template>
  <div class="rounded-md border border-border p-3">
    <div class="flex items-baseline justify-between gap-2">
      <h4 class="text-xs font-semibold text-foreground">{{ title }}</h4>
      <span class="text-xs tabular text-muted-foreground">{{ latest }}</span>
    </div>

    <ui-error-state
        v-if="state.error"
        :detail="state.errorDetail"
        :message="state.error"
        title="Could not read this chart"
        @retry="$emit('retry')"
    />

    <ui-deferred-loader v-else-if="state.loading && !state.loaded" :loading="true">
      <template #loading>
        <span aria-hidden="true" :style="{ height: `${height}px` }" class="mt-2 block rounded shimmer" />
      </template>
    </ui-deferred-loader>

    <p v-else-if="state.series.length === 0" class="mt-3 text-xs text-muted-foreground">
      {{ emptyNotice.description }}
    </p>

    <ui-time-chart
        v-else
        :height="height"
        :label="title"
        :series="state.series"
        :unit="kind"
        class="mt-2"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiTimeChart from '@/components/chart/UiTimeChart.vue'
import { MetricFormat, MetricsNoticeCatalog } from '@/domain/models/metrics'
import type { TMetricsNotice, TMetricSeriesKind } from '@/domain/models/metrics'
import type { TMetricsChartState } from '@/store/modules/metricsChart/types/TMetricsChartState'

@Component({
  components: { UiDeferredLoader, UiErrorState, UiTimeChart },
  emits: ['retry'],
})
export default class MetricsChartCard extends VueBase {
  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: true })
  public readonly kind: TMetricSeriesKind

  @Prop({ required: true })
  public readonly state: TMetricsChartState

  @Prop({ required: false, default: 160 })
  public readonly height: number

  public get emptyNotice(): TMetricsNotice {
    return MetricsNoticeCatalog.emptyRange
  }

  public get latest(): string {
    const total = this.state.series.reduce((sum, series) => sum + MetricsChartCard.lastOf(series.points), 0)

    return this.state.series.length === 0 ? '' : MetricFormat.of(this.kind, total)
  }

  private static lastOf(points: readonly { value: number }[]): number {
    return points.length === 0 ? 0 : points[points.length - 1].value
  }
}
</script>
