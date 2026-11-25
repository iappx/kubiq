<template>
  <div :data-density="density" class="flex flex-col min-h-0">
    <ui-progress-bar v-if="refreshing" label="Refreshing" />

    <div ref="scroller" class="relative min-h-0 overflow-auto" @keydown="onKeydown">
      <table :aria-label="label" class="ui-table">
        <thead>
          <tr>
            <th v-if="selectable" class="ui-sticky-cell w-8" scope="col" style="left: 0">
              <input
                  :aria-label="`Select all ${keys.length} loaded rows`"
                  :checked="allSelected"
                  :indeterminate.prop="partiallySelected"
                  type="checkbox"
                  @change="toggleAll"
              >
            </th>

            <th
                v-for="(column, index) in visibleColumns"
                :key="column.key"
                :aria-sort="ariaSort(column)"
                :class="[
                  column.align === 'right' ? 'text-right' : '',
                  isSticky(index) ? 'ui-sticky-cell ui-sticky-edge' : '',
                ]"
                :style="isSticky(index) ? { left: `${nameOffset}px`, width: column.width } : { width: column.width }"
                scope="col"
            >
              <button
                  v-if="isSortable(column)"
                  :class="column.align === 'right' ? 'ml-auto flex' : ''"
                  class="ui-sort-button"
                  type="button"
                  @click="toggleSort(column.key)"
              >
                {{ column.title }}
                <arrow-up v-if="sortDirection(column) === 'asc'" :size="12" aria-hidden="true" />
                <arrow-down v-else-if="sortDirection(column) === 'desc'" :size="12" aria-hidden="true" />
              </button>
              <span v-else>{{ column.title }}</span>
            </th>

            <th v-if="hasActions" class="w-8" scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="virtualWindow.topSpacerPx > 0" aria-hidden="true" class="ui-virtual-spacer">
            <td :colspan="columnCount" :style="{ height: `${virtualWindow.topSpacerPx}px`, padding: 0, border: 0 }" />
          </tr>

          <tr
              v-for="entry in visibleEntries"
              :key="entry.key"
              :data-busy="isBusy(entry.key) ? 'true' : undefined"
              :data-cursor="entry.key === cursor ? 'true' : undefined"
              :data-flash="flashTone(entry.row, entry.key)"
              :data-row-key="entry.key"
              :data-selected="isSelected(entry.key) ? 'true' : undefined"
              tabindex="-1"
              @click="onRowClick(entry.row, entry.key)"
              @contextmenu.prevent="openMenuAt($event.clientX, $event.clientY, entry.key)"
          >
            <td v-if="selectable" class="ui-sticky-cell w-8" style="left: 0">
              <input
                  :aria-label="`Select ${rowLabel(entry.row, entry.key)}`"
                  :checked="isSelected(entry.key)"
                  type="checkbox"
                  @click.stop="onSelectClick($event, entry.key)"
              >
            </td>

            <td
                v-for="(column, columnIndex) in visibleColumns"
                :key="column.key"
                :class="[
                  column.align === 'right' ? 'text-right tabular' : '',
                  isSticky(columnIndex) ? 'ui-sticky-cell ui-sticky-edge' : '',
                ]"
                :style="isSticky(columnIndex) ? { left: `${nameOffset}px` } : undefined"
            >
              <slot :column="column" :name="`cell-${column.key}`" :row="entry.row" :value="valueOf(entry.row, column.key)">
                <button
                    v-if="column.key === resolvedNameKey"
                    :title="cellText(entry.row, column.key)"
                    class="ui-name-button ui-cell"
                    type="button"
                    @click.stop="open(entry.row, entry.key)"
                >
                  {{ cellText(entry.row, column.key) }}
                </button>
                <span v-else :title="cellText(entry.row, column.key)" class="ui-cell">{{ cellText(entry.row, column.key) }}</span>
              </slot>
            </td>

            <td v-if="hasActions" class="w-8">
              <button
                  :aria-label="`Actions for ${rowLabel(entry.row, entry.key)}`"
                  :title="`Actions for ${rowLabel(entry.row, entry.key)}`"
                  class="btn-icon w-7 h-7"
                  type="button"
                  @click.stop="openMenuFrom($event, entry.key)"
              >
                <ellipsis-vertical :size="14" />
              </button>
            </td>
          </tr>

          <tr v-if="virtualWindow.bottomSpacerPx > 0" aria-hidden="true" class="ui-virtual-spacer">
            <td :colspan="columnCount" :style="{ height: `${virtualWindow.bottomSpacerPx}px`, padding: 0, border: 0 }" />
          </tr>

          <tr v-if="sortedRows.length === 0">
            <td :colspan="columnCount" class="text-center text-muted-foreground">
              <slot name="empty">Nothing to show</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ui-context-menu
        v-model:open="menuOpen"
        :items="menuItems"
        :x="menuX"
        :y="menuY"
        @closed="restoreFocus"
        @select="onAction"
    />
  </div>
</template>

<script lang="ts">
import { nextTick } from 'vue'
import { Component, Prop, Watch, VueBase } from '@iappx/vue-facing-di'
import { ArrowDown, ArrowUp, EllipsisVertical } from '@lucide/vue'
import UiContextMenu from '@/components/common/menu/UiContextMenu.vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import { UiFlashController } from '@/components/common/table/UiFlashController'
import { UiKeyboard } from '@/components/common/UiKeyboard'
import { UiTableCursor } from '@/components/common/table/UiTableCursor'
import { UiTableSelection } from '@/components/common/table/UiTableSelection'
import { UiTableSorter } from '@/components/common/table/UiTableSorter'
import { UiTableValue } from '@/components/common/table/UiTableValue'
import { UiTableVirtualizer } from '@/components/common/table/UiTableVirtualizer'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TUiVirtualWindow } from '@/components/common/table/types/TUiVirtualWindow'

@Component({
  components: { ArrowDown, ArrowUp, EllipsisVertical, UiContextMenu, UiProgressBar },
  emits: ['update:sort', 'update:selected', 'update:cursor', 'open', 'action'],
})
export default class UiDataTable extends VueBase {
  private static readonly selectColumnWidth = 32

  @Prop({ required: true })
  public readonly columns: TUiTableColumn[]

  @Prop({ required: true })
  public readonly rows: any[]

  @Prop({ required: true })
  public readonly rowKey: string

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false })
  public readonly nameKey?: string

  @Prop({ required: false, default: null })
  public readonly sort?: TUiTableSort | null

  @Prop({ required: false, default: () => [] })
  public readonly selected?: string[]

  @Prop({ required: false, default: null })
  public readonly cursor?: string | null

  @Prop({ required: false, type: Boolean, default: false })
  public readonly selectable?: boolean

  @Prop({ required: false, default: 'compact' })
  public readonly density?: TUiTableDensity

  @Prop({ required: false, default: () => [] })
  public readonly hiddenKeys?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly actions?: TUiMenuItem[]

  @Prop({ required: false, default: () => [] })
  public readonly busyKeys?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly flashKeys?: string[]

  @Prop({ required: false, type: Boolean, default: false })
  public readonly refreshing?: boolean

  @Prop({ required: false, type: Boolean, default: true })
  public readonly stickyName?: boolean

  @Prop({ required: false })
  public readonly toneOf?: (row: any) => TUiTone

  @Prop({ required: false })
  public readonly labelOf?: (row: any) => string

  @Prop({ required: false })
  public readonly actionsOf?: (row: any) => TUiMenuItem[]

  public flashing: string[] = []

  public menuOpen = false

  public menuX = 0

  public menuY = 0

  public menuRowKey: string | null = null

  public scrollTop = 0

  public viewportHeight = 0

  public headerHeight = 0

  private readonly flashController = new UiFlashController()

  private flashTimer: ReturnType<typeof setTimeout> | null = null

  private anchorKey: string | null = null

  private scrollFrame: number | null = null

  private resizeObserver: ResizeObserver | null = null

  private onScrollerScroll: (() => void) | null = null

  private pendingFocusKey: string | null = null

  public get visibleColumns(): TUiTableColumn[] {
    const hidden = this.hiddenKeys ?? []
    return this.columns.filter(column => column.locked === true || !hidden.includes(column.key))
  }

  public get sortedRows(): any[] {
    return UiTableSorter.sort(this.rows, this.sort ?? null)
  }

  public get keys(): string[] {
    return this.sortedRows.map(row => String(UiTableValue.read(row, this.rowKey)))
  }

  public get virtualWindow(): TUiVirtualWindow {
    return UiTableVirtualizer.compute({
      totalRows: this.sortedRows.length,
      scrollTop: this.scrollTop,
      viewportHeight: this.viewportHeight,
      density: this.density,
    })
  }

  public get visibleEntries(): Array<{ row: any; key: string; index: number }> {
    const rows = this.sortedRows
    const keys = this.keys
    const { startIndex, endIndex } = this.virtualWindow
    const result: Array<{ row: any; key: string; index: number }> = []
    for (let index = startIndex; index < endIndex; index++) {
      result.push({ row: rows[index], key: keys[index], index })
    }
    return result
  }

  public get resolvedNameKey(): string {
    return this.nameKey ?? this.visibleColumns[0]?.key ?? ''
  }

  public get hasActions(): boolean {
    return (this.actions ?? []).length > 0
  }

  public get menuItems(): TUiMenuItem[] {
    const row = this.rowOf(this.menuRowKey)

    return this.actionsOf && row !== undefined ? this.actionsOf(row) : (this.actions ?? [])
  }

  public get nameOffset(): number {
    return this.selectable ? UiDataTable.selectColumnWidth : 0
  }

  public get columnCount(): number {
    return this.visibleColumns.length + (this.selectable ? 1 : 0) + (this.hasActions ? 1 : 0)
  }

  public get allSelected(): boolean {
    return UiTableSelection.isPageSelected(this.selected ?? [], this.keys)
  }

  public get partiallySelected(): boolean {
    return UiTableSelection.isPagePartial(this.selected ?? [], this.keys)
  }

  @Watch('flashKeys')
  flashKeysChanged(keys: string[]): void {
    this.flash(keys ?? [])
  }

  @Watch('rows')
  rowsChanged(): void {
    this.clampScrollTop()
  }

  @Watch('sort')
  sortChanged(): void {
    this.clampScrollTop()
  }

  @Watch('density')
  densityChanged(): void {
    void nextTick(() => this.measureViewport())
  }

  mounted(): void {
    this.measureViewport()
    const scroller = this.scrollerElement()
    if (!scroller) {
      return
    }

    this.onScrollerScroll = () => this.scheduleScrollSync()
    scroller.addEventListener('scroll', this.onScrollerScroll, { passive: true })

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measureViewport())
      this.resizeObserver.observe(scroller)
    }
  }

  beforeUnmount(): void {
    this.cancelFlashTimer()
    this.cancelScrollFrame()

    const scroller = this.scrollerElement()
    if (scroller && this.onScrollerScroll) {
      scroller.removeEventListener('scroll', this.onScrollerScroll)
    }
    this.onScrollerScroll = null

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }

  public flash(keys: readonly string[]): void {
    if (keys.length === 0) {
      return
    }

    this.flashController.flash(keys, Date.now())
    this.flashing = this.flashController.keys()
    this.scheduleFlashPrune()
  }

  public isSortable(column: TUiTableColumn): boolean {
    return column.sortable !== false
  }

  public ariaSort(column: TUiTableColumn): 'ascending' | 'descending' | 'none' | undefined {
    return this.isSortable(column) ? UiTableSorter.ariaSort(this.sort ?? null, column.key) : undefined
  }

  public sortDirection(column: TUiTableColumn): 'asc' | 'desc' | null {
    return this.sort && this.sort.key === column.key ? this.sort.direction : null
  }

  public toggleSort(key: string): void {
    this.$emit('update:sort', UiTableSorter.next(this.sort ?? null, key))
  }

  public isSticky(index: number): boolean {
    return this.stickyName !== false && index === 0
  }

  public isSelected(key: string): boolean {
    return (this.selected ?? []).includes(key)
  }

  public isBusy(key: string): boolean {
    return (this.busyKeys ?? []).includes(key)
  }

  public valueOf(row: any, key: string): unknown {
    return UiTableValue.read(row, key)
  }

  public cellText(row: any, key: string): string {
    return UiTableValue.text(UiTableValue.read(row, key))
  }

  public rowLabel(row: any, key: string): string {
    if (this.labelOf) {
      return this.labelOf(row)
    }
    const name = this.cellText(row, this.resolvedNameKey)
    return name.length > 0 ? name : key
  }

  public flashTone(row: any, key: string): 'ok' | 'warning' | 'error' | undefined {
    if (!this.flashing.includes(key)) {
      return undefined
    }

    const tone = this.toneOf ? this.toneOf(row) : 'ok'
    return tone === 'warning' || tone === 'error' ? tone : 'ok'
  }

  public setCursor(key: string | null): void {
    if (key !== this.cursor) {
      this.$emit('update:cursor', key)
    }
  }

  public onRowClick(row: any, key: string): void {
    if (this.isSelectingText()) {
      this.setCursor(key)
      return
    }

    this.open(row, key)
  }

  public open(row: any, key: string): void {
    this.setCursor(key)
    this.$emit('open', row)
  }

  public toggleAll(): void {
    this.$emit('update:selected', UiTableSelection.togglePage(this.selected ?? [], this.keys))
  }

  public onSelectClick(event: MouseEvent, key: string): void {
    this.applySelection(key, event.shiftKey)
  }

  public openMenuFrom(event: MouseEvent, key: string): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    this.openMenuAt(rect.left, rect.bottom, key)
  }

  public openMenuAt(x: number, y: number, key: string): void {
    if (!this.hasActions) {
      return
    }

    this.setCursor(key)
    this.menuRowKey = key
    this.menuX = x
    this.menuY = y
    this.menuOpen = true
  }

  public onAction(action: string): void {
    const row = this.rowOf(this.menuRowKey)
    if (row !== undefined) {
      this.$emit('action', { action, row })
    }
  }

  public restoreFocus(): void {
    this.focusRow(this.menuRowKey)
    this.menuRowKey = null
  }

  public onKeydown(event: KeyboardEvent): void {
    if (UiKeyboard.isTyping(event.target) || event.defaultPrevented) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        this.moveCursor(1)
        break
      case 'ArrowUp':
        this.moveCursor(-1)
        break
      case 'Home':
        this.jumpCursor(UiTableCursor.first(this.keys))
        break
      case 'End':
        this.jumpCursor(UiTableCursor.last(this.keys))
        break
      case 'Enter':
        this.openCursorRow()
        break
      case ' ':
        this.toggleCursorRow(event.shiftKey)
        break
      case 'Escape':
        this.setCursor(null)
        break
      default:
        return
    }

    event.preventDefault()
  }

  private isSelectingText(): boolean {
    return window.getSelection()?.isCollapsed === false
  }

  private moveCursor(delta: number): void {
    this.jumpCursor(UiTableCursor.move(this.keys, this.cursor ?? null, delta))
  }

  private jumpCursor(key: string | null): void {
    this.setCursor(key)
    this.focusRow(key)
  }

  private openCursorRow(): void {
    const row = this.rowOf(this.cursor ?? null)
    if (row !== undefined) {
      this.$emit('open', row)
    }
  }

  private toggleCursorRow(extend: boolean): void {
    if (!this.selectable || !this.cursor) {
      return
    }
    this.applySelection(this.cursor, extend)
  }

  private applySelection(key: string, extend: boolean): void {
    const current = this.selected ?? []
    const next = extend && this.anchorKey !== null
        ? UiTableSelection.range(current, this.keys, this.anchorKey, key)
        : UiTableSelection.toggle(current, key)

    this.anchorKey = key
    this.$emit('update:selected', next)
  }

  private rowOf(key: string | null): any | undefined {
    if (key === null) {
      return undefined
    }
    const index = this.keys.indexOf(key)
    return index < 0 ? undefined : this.sortedRows[index]
  }

  private focusRow(key: string | null): void {
    if (key === null) {
      return
    }

    const scroller = this.scrollerElement()
    if (!scroller) {
      return
    }

    const window = this.virtualWindow
    if (window.active) {
      const index = this.keys.indexOf(key)
      if (index >= 0) {
        const headerHeightPx = this.headerHeight || (scroller.querySelector('thead')?.offsetHeight ?? 0)
        const nextScrollTop = UiTableVirtualizer.scrollTopForIndex({
          index,
          rowHeightPx: window.rowHeightPx,
          scrollTop: this.scrollTop,
          viewportHeight: this.viewportHeight,
          headerHeightPx,
        })
        if (nextScrollTop !== null) {
          this.cancelScrollFrame()
          this.scrollTop = nextScrollTop
          scroller.scrollTop = nextScrollTop
          this.pendingFocusKey = key
          void nextTick(() => {
            if (this.pendingFocusKey !== key) {
              return
            }
            this.pendingFocusKey = null
            const row = this.findRowElement(scroller, key)
            row?.focus({ preventScroll: true })
          })
          return
        }
      }
    }

    this.pendingFocusKey = null
    const row = this.findRowElement(scroller, key)
    row?.focus()
    if (!window.active) {
      row?.scrollIntoView?.({ block: 'nearest' })
    }
  }

  private scrollerElement(): HTMLElement | undefined {
    return this.$refs.scroller as HTMLElement | undefined
  }

  private findRowElement(scroller: HTMLElement, key: string): HTMLElement | null {
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(key)
      : key.replace(/["\\]/g, '\\$&')
    return scroller.querySelector<HTMLElement>(`[data-row-key="${escaped}"]`)
  }

  private measureViewport(): void {
    const scroller = this.scrollerElement()
    if (!scroller) {
      return
    }

    this.viewportHeight = scroller.clientHeight
    const thead = scroller.querySelector('thead')
    this.headerHeight = thead ? thead.offsetHeight : 0
    this.clampScrollTop()
  }

  private clampScrollTop(): void {
    if (this.viewportHeight <= 0) {
      return
    }

    const clamped = UiTableVirtualizer.clampScrollTop({
      totalRows: this.sortedRows.length,
      scrollTop: this.scrollTop,
      viewportHeight: this.viewportHeight,
      headerHeightPx: this.headerHeight,
      rowHeightPx: UiTableVirtualizer.rowHeight(this.density),
    })
    if (clamped !== this.scrollTop) {
      this.scrollTop = clamped
    }
    const scroller = this.scrollerElement()
    if (scroller && scroller.scrollTop > clamped) {
      scroller.scrollTop = clamped
    }
  }

  private scheduleScrollSync(): void {
    if (this.scrollFrame !== null) {
      return
    }

    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null
      const scroller = this.scrollerElement()
      if (scroller) {
        this.scrollTop = scroller.scrollTop
      }
    })
  }

  private cancelScrollFrame(): void {
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame)
      this.scrollFrame = null
    }
  }

  private scheduleFlashPrune(): void {
    if (this.flashTimer !== null) {
      return
    }

    this.flashTimer = setTimeout(() => {
      this.flashTimer = null
      this.flashController.prune(Date.now())
      this.flashing = this.flashController.keys()
      if (this.flashController.active) {
        this.scheduleFlashPrune()
      }
    }, UiFlashController.defaultDurationMs)
  }

  private cancelFlashTimer(): void {
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer)
      this.flashTimer = null
    }
  }
}
</script>
