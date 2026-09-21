<template>
  <select-root v-model="value">
    <div class="relative flex items-center w-full">
      <select-trigger
          :class="{ 'pr-8': allowClear && value }"
          class="ui-input flex h-10 items-center justify-between disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
      >
        <select-value :placeholder="placeholder || ''" />
        <chevron-down class="h-4 w-4 opacity-50" />
      </select-trigger>
      <button
          v-if="allowClear && value"
          aria-label="Clear"
          class="absolute right-2 z-10 flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          type="button"
          @click.stop="value = ''"
      >
        <x class="h-4 w-4 opacity-50" />
      </button>
    </div>

    <select-portal>
      <select-content
          class="relative z-[200] max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          position="popper"
      >
        <select-scroll-up-button />
        <select-viewport class="p-1 w-full min-w-[var(--reka-select-trigger-width)]">
          <select-item
              v-for="item in selectItems"
              :key="item.key"
              :value="item.key"
              class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              <select-item-indicator>
                <check class="h-4 w-4" />
              </select-item-indicator>
            </span>
            <select-item-text>
              {{ item.title }}
            </select-item-text>
          </select-item>
        </select-viewport>
      </select-content>
    </select-portal>
  </select-root>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { Check, ChevronDown, X } from '@lucide/vue'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

export type TSelectItem = {
  key: string
  title: string
}

@Component({
  components: {
    SelectItemIndicator,
    SelectItemText,
    SelectItem,
    SelectViewport,
    SelectScrollUpButton,
    SelectContent,
    SelectPortal,
    SelectValue,
    SelectTrigger,
    SelectRoot,
    Check,
    ChevronDown,
    X,
  },
})
export default class UiSelect extends VueBase {
  @Prop({ required: true })
  public readonly items: Record<string, any>[]

  @Prop({ required: true })
  public readonly itemKey: string

  @Prop({ required: true })
  public readonly itemTitle: string

  @Prop({ required: false })
  public readonly placeholder?: string

  @Prop({ required: false })
  public readonly allowClear?: boolean

  @VModel()
  public value: string

  public get selectItems(): TSelectItem[] {
    return this.items.map(item => ({
      key: item[this.itemKey],
      title: item[this.itemTitle],
    }))
  }
}
</script>
