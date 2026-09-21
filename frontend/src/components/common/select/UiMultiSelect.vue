<template>
  <select-root v-model="selected" multiple>
    <select-trigger
        :aria-label="label"
        class="ui-input flex h-8 items-center justify-between gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span :class="['truncate', selected.length === 0 ? 'text-muted-foreground' : '']">{{ summary }}</span>
      <chevron-down :size="14" aria-hidden="true" class="opacity-50 shrink-0" />
    </select-trigger>

    <select-portal>
      <select-content class="ui-menu max-h-96 overflow-hidden" position="popper">
        <select-viewport class="p-1 w-full min-w-[var(--reka-select-trigger-width)]">
          <select-item
              v-for="option in options"
              :key="option.key"
              :value="option.key"
              class="ui-menu-item relative pl-7"
          >
            <span class="absolute left-2 inline-flex items-center justify-center">
              <select-item-indicator>
                <check :size="12" />
              </select-item-indicator>
            </span>
            <select-item-text>{{ option.title }}</select-item-text>
          </select-item>
        </select-viewport>
      </select-content>
    </select-portal>
  </select-root>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Check, ChevronDown } from '@lucide/vue'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
} from 'reka-ui'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'

@Component({
  components: {
    Check,
    ChevronDown,
    SelectContent,
    SelectItem,
    SelectItemIndicator,
    SelectItemText,
    SelectPortal,
    SelectRoot,
    SelectTrigger,
    SelectViewport,
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

  public get summary(): string {
    if (this.selected.length === 0) {
      return this.placeholder ?? ''
    }
    if (this.selected.length === 1) {
      return this.options.find(option => option.key === this.selected[0])?.title ?? this.selected[0]
    }
    return `${this.selected.length} selected`
  }
}
</script>
