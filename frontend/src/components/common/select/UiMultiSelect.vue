<template>
  <combobox-root
      v-model="selected"
      :reset-search-term-on-select="false"
      multiple
      open-on-click
      open-on-focus
  >
    <combobox-anchor
        class="ui-input flex h-8 items-center justify-between gap-2 text-xs"
    >
      <combobox-input
          :aria-label="label"
          :class="selected.length === 0 ? 'placeholder:text-muted-foreground' : 'placeholder:text-foreground'"
          :placeholder="summary"
          class="min-w-0 flex-1 truncate bg-transparent outline-none"
      />
      <combobox-trigger
          aria-label="Show options"
          class="shrink-0"
          tabindex="-1"
          title="Show options"
      >
        <chevron-down :size="14" aria-hidden="true" class="opacity-50" />
      </combobox-trigger>
    </combobox-anchor>

    <combobox-portal>
      <combobox-content class="ui-menu max-h-96 overflow-hidden" position="popper">
        <combobox-viewport class="p-1 w-full min-w-[var(--reka-combobox-trigger-width)]">
          <combobox-empty class="px-2 py-1.5 text-xs text-muted-foreground">
            Nothing matches what you typed
          </combobox-empty>

          <combobox-item
              v-for="option in items"
              :key="option.key"
              :text-value="option.title"
              :value="option.key"
              class="ui-menu-item relative pl-7"
          >
            <span class="absolute left-2 inline-flex items-center justify-center">
              <combobox-item-indicator>
                <check :size="12" />
              </combobox-item-indicator>
            </span>
            {{ option.title }}
          </combobox-item>
        </combobox-viewport>
      </combobox-content>
    </combobox-portal>
  </combobox-root>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Check, ChevronDown } from '@lucide/vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { UiSelectOptions } from '@/components/common/select/UiSelectOptions'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'

@Component({
  components: {
    Check,
    ChevronDown,
    ComboboxAnchor,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxItemIndicator,
    ComboboxPortal,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
  },
  emits: ['update:modelValue'],
})
export default class UiMultiSelect extends VueBase {
  @Prop({ required: true })
  public readonly options: TUiSelectOption[]

  @Prop({ required: false, default: () => [] })
  public readonly modelValue?: string[]

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: 'Select' })
  public readonly placeholder?: string

  public get selected(): string[] {
    return this.modelValue ?? []
  }

  public set selected(value: string[]) {
    this.$emit('update:modelValue', value)
  }

  public get items(): TUiSelectOption[] {
    return UiSelectOptions.withSelected(this.options, this.selected)
  }

  // The field holds what the user is typing, so what is chosen has to read from the placeholder.
  public get summary(): string {
    if (this.selected.length === 0) {
      return this.placeholder ?? ''
    }
    if (this.selected.length === 1) {
      return this.items.find(option => option.key === this.selected[0])?.title ?? this.selected[0]
    }
    return `${this.selected.length} selected`
  }
}
</script>
