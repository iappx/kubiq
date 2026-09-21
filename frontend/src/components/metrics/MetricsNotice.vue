<template>
  <div class="flex items-start gap-3 rounded-md border border-dashed border-border px-3 py-3">
    <component :is="icon" :size="16" aria-hidden="true" class="mt-0.5 shrink-0 text-muted-foreground" />
    <div class="min-w-0">
      <p class="text-sm font-medium text-foreground">{{ notice.title }}</p>
      <p class="text-xs text-muted-foreground">{{ notice.description }}</p>
    </div>
    <router-link v-if="settingsPath" :to="settingsPath" class="ml-auto shrink-0 text-xs text-primary hover:underline">
      Open settings
    </router-link>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChartLine, Lock, Power } from '@lucide/vue'
import type { Component as VueComponent } from 'vue'
import type { TMetricsNotice, TMetricsState } from '@/domain/models/metrics'

@Component({})
export default class MetricsNotice extends VueBase {
  @Prop({ required: true })
  public readonly notice: TMetricsNotice

  @Prop({ required: true })
  public readonly state: TMetricsState

  @Prop({ required: false, default: '' })
  public readonly settingsPath?: string

  public get icon(): VueComponent {
    if (this.state === 'forbidden') {
      return Lock
    }

    return this.state === 'off' ? Power : ChartLine
  }
}
</script>
