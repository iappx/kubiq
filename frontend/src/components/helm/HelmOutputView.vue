<template>
  <div ref="scroller" class="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted">
    <pre class="p-3 text-xs leading-5 text-foreground whitespace-pre-wrap break-words">{{ text }}</pre>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, VueBase } from '@iappx/vue-facing-di'
import { nextTick } from 'vue'

@Component({})
export default class HelmOutputView extends VueBase {
  @Prop({ required: true })
  public readonly lines: readonly string[]

  @Prop({ required: true })
  public readonly revision: number

  @Prop({ required: false, default: true })
  public readonly autoscroll?: boolean

  public get text(): string {
    return this.lines.join('\n')
  }

  mounted(): void {
    void this.scrollToEnd()
  }

  @Watch('revision')
  revisionChanged(): void {
    void this.scrollToEnd()
  }

  private async scrollToEnd(): Promise<void> {
    if (this.autoscroll === false) {
      return
    }

    await nextTick()
    const scroller = this.$refs.scroller as HTMLElement | undefined
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }
}
</script>
