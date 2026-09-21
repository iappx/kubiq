<template>
  <dropdown-menu-root>
    <dropdown-menu-trigger as-child>
      <button aria-label="Choose columns" class="btn-icon w-7 h-7" title="Choose columns" type="button">
        <columns3 :size="14" />
      </button>
    </dropdown-menu-trigger>

    <dropdown-menu-portal>
      <dropdown-menu-content :side-offset="4" align="end" class="ui-menu">
        <dropdown-menu-label class="px-2 py-1 text-xs text-muted-foreground">Columns</dropdown-menu-label>

        <dropdown-menu-checkbox-item
            v-for="column in columns"
            :key="column.key"
            :disabled="column.locked === true"
            :model-value="isVisible(column)"
            class="ui-menu-item relative pl-7 data-[disabled]:opacity-50"
            @select="keepOpen"
            @update:model-value="toggle(column, $event)"
        >
          <span class="absolute left-2 inline-flex items-center justify-center">
            <dropdown-menu-item-indicator>
              <check :size="12" />
            </dropdown-menu-item-indicator>
          </span>
          {{ column.title }}
        </dropdown-menu-checkbox-item>
      </dropdown-menu-content>
    </dropdown-menu-portal>
  </dropdown-menu-root>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Check, Columns3 } from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { UiTableColumns } from '@/components/common/table/UiTableColumns'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

@Component({
  components: {
    Check,
    Columns3,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItemIndicator,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRoot,
    DropdownMenuTrigger,
  },
  emits: ['update:hiddenKeys'],
})
export default class UiColumnPicker extends VueBase {
  @Prop({ required: true })
  public readonly columns: TUiTableColumn[]

  @Prop({ required: false, default: () => [] })
  public readonly hiddenKeys?: string[]

  public isVisible(column: TUiTableColumn): boolean {
    return UiTableColumns.isVisible(column, this.hiddenKeys ?? [])
  }

  public toggle(column: TUiTableColumn, visible: boolean): void {
    this.$emit('update:hiddenKeys', UiTableColumns.toggle(column, this.hiddenKeys ?? [], visible))
  }

  public keepOpen(event: Event): void {
    event.preventDefault()
  }
}
</script>
