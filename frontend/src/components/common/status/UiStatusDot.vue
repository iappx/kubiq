<template>
  <svg
      :aria-hidden="label ? undefined : 'true'"
      :aria-label="label"
      :class="toneClass"
      :height="size"
      :role="label ? 'img' : undefined"
      :width="size"
      class="shrink-0"
      fill="none"
      viewBox="0 0 10 10"
      xmlns="http://www.w3.org/2000/svg"
  >
    <circle v-if="shape === 'dot'" cx="5" cy="5" fill="currentColor" r="3.5" />
    <circle v-else-if="shape === 'ring'" cx="5" cy="5" r="3" stroke="currentColor" stroke-width="2" />
    <circle v-else-if="shape === 'hollow'" cx="5" cy="5" r="3.25" stroke="currentColor" stroke-width="1.25" />
    <path v-else-if="shape === 'triangle'" d="M5 1.1 9.4 8.7H0.6Z" fill="currentColor" />
    <path v-else d="M3.6 0.8h2.8L8.9 3.3v3.4L6.4 9.2H3.6L1.1 6.7V3.3Z" fill="currentColor" />
  </svg>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

type TShape = 'dot' | 'ring' | 'hollow' | 'triangle' | 'octagon'

@Component({})
export default class UiStatusDot extends VueBase {
  @Prop({ required: true })
  public readonly tone: TUiTone

  @Prop({ required: false })
  public readonly label?: string

  @Prop({ required: false, default: 10 })
  public readonly size?: number

  public get shape(): TShape {
    const shapes: Record<TUiTone, TShape> = {
      ok: 'dot',
      pending: 'ring',
      warning: 'triangle',
      error: 'octagon',
      unknown: 'hollow',
      info: 'dot',
    }
    return shapes[this.tone] ?? 'hollow'
  }

  public get toneClass(): string {
    const classes: Record<TUiTone, string> = {
      ok: 'text-success',
      pending: 'text-muted-foreground',
      warning: 'text-warning',
      error: 'text-destructive',
      unknown: 'text-border',
      info: 'text-primary',
    }
    return classes[this.tone] ?? classes.unknown
  }
}
</script>
