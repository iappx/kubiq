<template>
  <div class="space-y-2">
    <ui-progress-bar :indeterminate="total <= 0" :value="percent" label="Downloading the update" />

    <div class="flex items-center justify-between gap-3">
      <span class="text-xs text-muted-foreground tabular">{{ amount }}</span>
      <button class="btn-secondary" type="button" @click="$emit('cancel')">
        <x :size="14" aria-hidden="true" />
        Cancel
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { X } from '@lucide/vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import { MetricFormat } from '@/domain/models/metrics/MetricFormat'

@Component({
  components: { UiProgressBar, X },
  emits: ['cancel'],
})
export default class SettingsUpdateProgress extends VueBase {
  @Prop({ required: true, type: Number })
  public readonly received: number

  @Prop({ required: true, type: Number })
  public readonly total: number

  public get percent(): number {
    return this.total > 0 ? Math.min(100, Math.floor(this.received / this.total * 100)) : 0
  }

  public get amount(): string {
    const received = MetricFormat.bytes(this.received)

    return this.total > 0
      ? `${received} of ${MetricFormat.bytes(this.total)} · ${this.percent}%`
      : received
  }
}
</script>
