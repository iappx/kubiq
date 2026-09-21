<template>
  <li class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
    <div class="min-w-0">
      <div :title="entry.clusterId" class="truncate text-sm font-medium text-foreground">{{ entry.clusterId }}</div>
      <div :title="target" class="truncate text-xs text-muted-foreground">{{ sourceTitle }} · {{ target }}</div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <button
          :aria-label="`Edit the Prometheus source of ${entry.clusterId}`"
          :title="`Edit the Prometheus source of ${entry.clusterId}`"
          class="btn-icon w-7 h-7"
          type="button"
          @click="$emit('edit', entry)"
      >
        <pencil :size="14" />
      </button>
      <button
          :aria-label="`Remove the Prometheus source of ${entry.clusterId}`"
          :title="`Remove the Prometheus source of ${entry.clusterId}`"
          class="btn-icon w-7 h-7 hover:text-destructive"
          type="button"
          @click="$emit('remove', entry.clusterId)"
      >
        <trash-2 :size="14" />
      </button>
    </div>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Pencil, Trash2 } from '@lucide/vue'
import { PrometheusSourceCatalog } from '@/domain/entities/settings'
import type { TClusterSettingsDraft } from '@/domain/entities/settings'
import { PrometheusLayoutCatalog } from '@/domain/models/metrics'

@Component({
  components: { Pencil, Trash2 },
  emits: ['edit', 'remove'],
})
export default class SettingsPrometheusRow extends VueBase {
  @Prop({ required: true })
  public readonly entry: TClusterSettingsDraft

  public get sourceTitle(): string {
    return PrometheusSourceCatalog.title(this.entry.prometheusSource)
  }

  public get target(): string {
    if (this.entry.prometheusSource === 'url') {
      return `${this.entry.prometheusUrl} · ${this.layoutTitle}`
    }
    if (this.entry.prometheusSource === 'service') {
      return `${this.entry.prometheusService} · ${this.layoutTitle}`
    }

    return this.entry.prometheusSource === 'auto'
        ? 'Discovered in the cluster, layout taken from the preset that matched'
        : 'Metrics are off for this cluster'
  }

  private get layoutTitle(): string {
    return PrometheusLayoutCatalog.title(this.entry.prometheusLayout)
  }
}
</script>
