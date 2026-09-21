<template>
  <div class="pod-log-body relative flex-1 min-h-0">
    <div
        ref="scroller"
        :aria-label="label"
        class="pod-log-scroller h-full w-full overflow-auto"
        role="region"
        tabindex="0"
        @scroll="onScroll"
    >
      <div ref="ruler" aria-hidden="true" class="pod-log-ruler">0123456789</div>

      <div :style="{ height: `${totalHeight}px`, minWidth: contentWidth ? `${contentWidth}px` : undefined }" class="relative">
        <div :style="{ transform: `translateY(${offsetTop}px)` }" class="absolute inset-x-0 top-0">
          <pod-log-row
              v-for="row in rows"
              :key="row.index"
              :height="rowHeight"
              :prefix="prefix"
              :query="query"
              :text="row.text"
              :timestamps="timestamps"
              :wrap="wrap"
          />
        </div>
      </div>

      <p v-if="rows.length === 0" class="px-3 py-2 text-xs text-muted-foreground">{{ emptyText }}</p>
    </div>

    <transition>
      <motion-div
          v-if="!autoscroll"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0 }"
          :initial="{ opacity: 0, y: 8 }"
          :transition="{ duration: enterDuration, ease: easeOut }"
          class="pod-log-jump"
      >
        <button class="pod-log-jump-button" type="button" @click="jumpToLatest">
          <arrow-down :size="12" />
          <span>{{ jumpText }}</span>
        </button>
      </motion-div>
    </transition>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { ArrowDown } from '@lucide/vue'
import { motion } from 'motion-v'
import PodLogRow from '@/components/logs/PodLogRow.vue'
import { PodLogHighlighter } from '@/components/logs/PodLogHighlighter'
import { PodLogLayout } from '@/components/logs/PodLogLayout'
import { PodLogView } from '@/components/logs/constants/PodLogView'
import type { TPodLogRow } from '@/components/logs/types/TPodLogRow'
import { UiMotion } from '@/constants/UiMotion'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'

@Component({
  components: { ArrowDown, MotionDiv: motion.div, PodLogRow },
})
export default class PodLogViewport extends VueBase {
  @Prop({ required: true })
  public readonly sessionKey: string

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: '' })
  public readonly prefix?: string

  public rows: TPodLogRow[] = []

  public offsetTop = 0

  public totalHeight = 0

  public contentWidth = 0

  public shownCount = 0

  public charWidth = 0

  private pausedTotal = 0

  private frame: number | null = null

  private observer: ResizeObserver | null = null

  constructor(
      @inject(AppUiStore) private readonly uiStore: AppUiStore,
      @inject(PodLogsStore) private readonly podLogsStore: PodLogsStore,
  ) {
    super()
  }

  public get rowHeight(): number {
    return this.uiStore.density === 'comfortable' ? PodLogView.comfortableRowPx : PodLogView.compactRowPx
  }

  public get query(): string {
    return this.podLogsStore.viewOf(this.sessionKey)?.search ?? ''
  }

  public get filterText(): string {
    const view = this.podLogsStore.viewOf(this.sessionKey)

    return view?.onlyMatches === true ? view.search : ''
  }

  public get wrap(): boolean {
    return this.podLogsStore.viewOf(this.sessionKey)?.wrap === true
  }

  public get timestamps(): boolean {
    return this.podLogsStore.viewOf(this.sessionKey)?.options.timestamps === true
  }

  public get autoscroll(): boolean {
    return this.podLogsStore.viewOf(this.sessionKey)?.autoscroll !== false
  }

  public get revision(): number {
    return this.podLogsStore.viewOf(this.sessionKey)?.revision ?? 0
  }

  public get received(): number {
    const view = this.podLogsStore.viewOf(this.sessionKey)

    return view ? view.lineCount + view.dropped : 0
  }

  public get emptyText(): string {
    if (this.filterText !== '') {
      return `No lines match "${this.filterText}"`
    }

    return 'No output yet'
  }

  public get jumpText(): string {
    const behind = Math.max(0, this.received - this.pausedTotal)

    return behind === 0 ? 'Jump to latest' : `${behind.toLocaleString('en')} new · jump to latest`
  }

  public get enterDuration(): number {
    return UiMotion.normal
  }

  public get easeOut(): [number, number, number, number] {
    return UiMotion.easeOut
  }

  // The line buffer is deliberately not reactive, so every input that changes the layout has to appear here.
  public get paintKey(): string {
    return [this.sessionKey, this.revision, this.filterText, this.wrap, this.rowHeight, this.prefix].join('|')
  }

  @Watch('paintKey')
  paintKeyChanged(): void {
    this.schedule()
  }

  @Watch('autoscroll')
  autoscrollChanged(autoscroll: boolean): void {
    if (!autoscroll) {
      this.pausedTotal = this.received
    }
  }

  mounted(): void {
    this.measure()
    this.watchSize()
    this.paint()
  }

  beforeUnmount(): void {
    if (this.frame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frame)
    }
    this.frame = null
    this.observer?.disconnect()
    this.observer = null
  }

  public onScroll(): void {
    const scroller = this.scroller()
    if (!scroller) {
      return
    }

    const atEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= PodLogView.bottomThresholdPx
    if (atEnd !== this.autoscroll) {
      this.podLogsStore.setAutoscroll(this.sessionKey, atEnd)
    }

    this.schedule()
  }

  public jumpToLatest(): void {
    this.podLogsStore.setAutoscroll(this.sessionKey, true)
    this.schedule()
  }

  private schedule(): void {
    if (this.frame !== null || typeof requestAnimationFrame !== 'function') {
      return
    }

    this.frame = requestAnimationFrame(() => this.paint())
  }

  private paint(): void {
    this.frame = null

    const scroller = this.scroller()
    if (!scroller) {
      return
    }

    const lines = this.podLogsStore.lines(this.sessionKey)
    const shown = this.filterText === ''
      ? lines
      : lines.filter(line => PodLogHighlighter.matches(line, this.filterText))

    const columns = PodLogLayout.columnsFor(
      scroller.clientWidth - (this.prefix ?? '').length * this.charWidth,
      this.charWidth,
      PodLogView.fallbackColumns,
    )
    const offsets = PodLogLayout.offsets(shown, this.rowHeight, columns, this.wrap)
    const height = scroller.clientHeight
    const top = this.autoscroll ? Math.max(0, offsets[shown.length] - height) : scroller.scrollTop
    const visible = PodLogLayout.window(offsets, top, height, PodLogView.overscan)

    this.offsetTop = visible.offsetTop
    this.totalHeight = visible.totalHeight
    this.shownCount = shown.length
    this.contentWidth = this.wrap ? 0 : PodLogViewport.widthOf(shown, this.charWidth)
    this.rows = shown
      .slice(visible.start, visible.end)
      .map((text, offset) => ({ index: visible.start + offset, text }))

    if (this.autoscroll) {
      void this.$nextTick(() => this.toEnd())
    }
  }

  private toEnd(): void {
    const scroller = this.scroller()
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }

  private measure(): void {
    const ruler = this.$refs.ruler as HTMLElement | undefined
    const width = ruler?.getBoundingClientRect().width ?? 0

    if (width > 0) {
      this.charWidth = width / 10
    }
  }

  private watchSize(): void {
    const scroller = this.scroller()
    if (!scroller || typeof ResizeObserver !== 'function') {
      return
    }

    this.observer = new ResizeObserver(() => {
      this.measure()
      this.schedule()
    })
    this.observer.observe(scroller)
  }

  private scroller(): HTMLElement | undefined {
    return this.$refs.scroller as HTMLElement | undefined
  }

  private static widthOf(lines: readonly string[], charWidth: number): number {
    if (charWidth <= 0) {
      return 0
    }

    let longest = 0
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].length > longest) {
        longest = lines[index].length
      }
    }

    return Math.ceil(longest * charWidth) + 24
  }
}
</script>

<style scoped>
.pod-log-body {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: var(--density-text);
  font-variant-ligatures: none;
  background-color: hsl(var(--background));
}

.pod-log-scroller:focus-visible {
  outline-offset: -2px;
}

.pod-log-ruler {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  pointer-events: none;
}

.pod-log-jump {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
}

.pod-log-jump-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding-inline: 12px;
  border-radius: 9999px;
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  box-shadow: var(--elevation-md);
  font-size: 12px;
  font-family: inherit;
}

.pod-log-jump-button:hover {
  background-color: hsl(var(--secondary));
}
</style>
