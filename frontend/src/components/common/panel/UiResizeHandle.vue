<template>
  <div
      :aria-label="label"
      :aria-orientation="orientation"
      :aria-valuemax="max"
      :aria-valuemin="min"
      :aria-valuenow="size"
      :data-dragging="dragging ? 'true' : undefined"
      class="ui-resize-handle"
      role="separator"
      tabindex="0"
      @keydown="onKeydown"
      @pointercancel="onPointerUp"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
  />
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { UiResizeController } from '@/components/common/panel/UiResizeController'

@Component({})
export default class UiResizeHandle extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly min: number

  @Prop({ required: true })
  public readonly max: number

  @Prop({ required: false, default: 'vertical' })
  public readonly orientation?: 'vertical' | 'horizontal'

  @Prop({ required: false, default: UiResizeController.defaultStep })
  public readonly step?: number

  // `type` is what makes Vue cast a bare `invert` attribute to true; without it the prop
  // arrives as an empty string and every `invert === true` below silently reads false.
  @Prop({ required: false, default: false, type: Boolean })
  public readonly invert?: boolean

  @VModel({ name: 'value' })
  public size: number

  public dragging = false

  private origin = 0

  private originValue = 0

  public onKeydown(event: KeyboardEvent): void {
    const next = UiResizeController.fromKey(
        event.key,
        this.size,
        this.min,
        this.max,
        this.step ?? UiResizeController.defaultStep,
        this.orientation ?? 'vertical',
        this.invert === true,
    )
    if (next === null) {
      return
    }

    event.preventDefault()
    this.size = next
  }

  public onPointerDown(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)
    this.dragging = true
    this.origin = this.position(event)
    this.originValue = this.size
    event.preventDefault()
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return
    }

    this.size = UiResizeController.fromPointer(
        this.origin,
        this.position(event),
        this.originValue,
        this.min,
        this.max,
        this.invert === true,
    )
  }

  public onPointerUp(event: PointerEvent): void {
    if (!this.dragging) {
      return
    }

    this.dragging = false
    const handle = event.currentTarget as HTMLElement
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId)
    }
  }

  private position(event: PointerEvent): number {
    return this.orientation === 'horizontal' ? event.clientY : event.clientX
  }
}
</script>
