<template>
  <div v-if="!loading" :class="faded ? 'ui-fade-in' : ''">
    <slot />
  </div>
  <div v-else-if="shown">
    <slot name="loading" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, VueBase } from '@iappx/vue-facing-di'
import { UiDeferredGate } from '@/components/common/feedback/UiDeferredGate'

@Component({})
export default class UiDeferredLoader extends VueBase {
  @Prop({ required: true })
  public readonly loading: boolean

  @Prop({ required: false, default: UiDeferredGate.defaultDelayMs })
  public readonly delay?: number

  public shown = false

  public faded = false

  private readonly gate = new UiDeferredGate()

  @Watch('loading')
  loadingChanged(loading: boolean): void {
    this.sync(loading)
  }

  created(): void {
    this.sync(this.loading)
  }

  beforeUnmount(): void {
    this.gate.cancel()
  }

  private sync(loading: boolean): void {
    this.gate.cancel()

    if (!loading) {
      // Nothing to fade from unless a skeleton was actually on screen.
      this.faded = this.shown
      this.shown = false
      return
    }

    this.faded = false
    this.gate.start(this.delay ?? UiDeferredGate.defaultDelayMs, () => {
      this.shown = true
    })
  }
}
</script>
