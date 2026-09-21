<template>
  <span :class="['inline-flex items-center gap-1 min-w-0', toneClass]">
    <ui-status-dot :size="size" :tone="tone" />
    <span class="truncate">{{ label }}</span>
  </span>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { UiStatusDot },
})
export default class UiStatusBadge extends VueBase {
  @Prop({ required: true })
  public readonly tone: TUiTone

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: 10 })
  public readonly size?: number

  public get toneClass(): string {
    const classes: Record<TUiTone, string> = {
      ok: 'text-foreground',
      pending: 'text-muted-foreground',
      warning: 'text-warning',
      error: 'text-destructive',
      unknown: 'text-muted-foreground',
      info: 'text-foreground',
    }
    return classes[this.tone] ?? classes.unknown
  }
}
</script>
