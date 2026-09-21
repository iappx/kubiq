<template>
  <div class="ui-toolbar">
    <div class="flex items-baseline gap-2 min-w-0">
      <h2 class="text-sm font-semibold text-foreground truncate">{{ title }}</h2>
      <span class="text-xs text-muted-foreground tabular shrink-0">{{ countLabel }}</span>
    </div>

    <p v-if="sortScope" class="text-xs text-muted-foreground truncate">{{ sortScope }}</p>

    <div class="ml-auto flex items-center gap-2">
      <slot name="status" />

      <ui-search-field
          :model-value="filter"
          :placeholder="filterPlaceholder"
          shortcut="/"
          @update:model-value="$emit('update:filter', $event)"
      />

      <slot name="actions" />

      <button
          :aria-label="densityLabel"
          :title="densityLabel"
          class="btn-icon w-7 h-7"
          type="button"
          @click="toggleDensity"
      >
        <rows3 v-if="density === 'compact'" :size="14" />
        <rows2 v-else :size="14" />
      </button>

      <ui-column-picker
          :columns="columns"
          :hidden-keys="hiddenKeys"
          @update:hidden-keys="$emit('update:hiddenKeys', $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Rows2, Rows3 } from '@lucide/vue'
import UiColumnPicker from '@/components/common/table/UiColumnPicker.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'

@Component({
  components: { Rows2, Rows3, UiColumnPicker, UiSearchField },
  emits: ['update:filter', 'update:density', 'update:hiddenKeys'],
})
export default class UiTableToolbar extends VueBase {
  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: true })
  public readonly count: number

  @Prop({ required: false })
  public readonly totalCount?: number

  @Prop({ required: false, default: false })
  public readonly sorted?: boolean

  @Prop({ required: false, default: '' })
  public readonly filter?: string

  @Prop({ required: false, default: 'Filter by name or label' })
  public readonly filterPlaceholder?: string

  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: false, default: () => [] })
  public readonly columns?: TUiTableColumn[]

  @Prop({ required: false, default: () => [] })
  public readonly hiddenKeys?: string[]

  public get countLabel(): string {
    const total = this.totalCount
    return total !== undefined && total > this.count
        ? `${this.format(this.count)} of ${this.format(total)}`
        : this.format(this.count)
  }

  public get sortScope(): string | null {
    const total = this.totalCount
    if (!this.sorted || total === undefined || total <= this.count) {
      return null
    }
    return `Sorted within ${this.format(this.count)} loaded of ${this.format(total)}`
  }

  public get densityLabel(): string {
    return this.density === 'compact' ? 'Switch to comfortable rows' : 'Switch to compact rows'
  }

  public toggleDensity(): void {
    this.$emit('update:density', this.density === 'compact' ? 'comfortable' : 'compact')
  }

  private format(value: number): string {
    return value.toLocaleString('en-US')
  }
}
</script>
