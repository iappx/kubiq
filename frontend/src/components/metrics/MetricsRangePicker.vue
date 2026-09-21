<template>
  <div aria-label="Chart range" class="flex items-center gap-1" role="group">
    <button
        v-for="option in options"
        :key="option"
        :aria-pressed="option === range ? 'true' : 'false'"
        :class="option === range ? 'pill pill-active' : 'pill'"
        :title="titleOf(option)"
        type="button"
        @click="$emit('update:range', option)"
    >
      {{ option }}
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { MetricRangeCatalog } from '@/domain/models/metrics'
import type { TMetricRangeId } from '@/domain/models/metrics'

@Component({
  emits: ['update:range'],
})
export default class MetricsRangePicker extends VueBase {
  @Prop({ required: true })
  public readonly range: TMetricRangeId

  public get options(): TMetricRangeId[] {
    return MetricRangeCatalog.all()
  }

  public titleOf(option: TMetricRangeId): string {
    return MetricRangeCatalog.title(option)
  }
}
</script>
