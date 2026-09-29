<template>
  <ui-form-field v-slot="{ fieldId, describedBy }" :error="error" :label="label">
    <autocomplete-root
        v-model="text"
        v-model:open="expanded"
        :disabled="disabled"
        ignore-filter
        open-on-click
    >
      <combobox-anchor class="ui-input flex items-center gap-2" @keydown.escape="closeOnEscape">
        <autocomplete-input
            :id="fieldId"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
            :placeholder="placeholder"
            autocomplete="off"
            class="min-w-0 flex-1 bg-transparent outline-none"
            spellcheck="false"
        />
        <combobox-trigger
            v-if="hasOptions"
            aria-label="Show options"
            class="shrink-0"
            tabindex="-1"
            title="Show options"
        >
          <chevron-down :size="14" aria-hidden="true" class="opacity-50" />
        </combobox-trigger>
      </combobox-anchor>

      <combobox-portal v-if="hasOptions">
        <combobox-content :side-offset="4" class="ui-menu" position="popper">
          <combobox-viewport class="w-full min-w-[var(--reka-combobox-trigger-width)]">
            <combobox-item
                v-for="option in options"
                :key="`${option.value}|${option.detail ?? ''}`"
                :disabled="option.disabled"
                :text-value="option.title"
                :value="option.value"
                class="ui-menu-item justify-between data-[disabled]:opacity-50"
            >
              <span class="tabular">{{ option.title }}</span>
              <span v-if="option.detail" class="truncate text-xs text-muted-foreground">{{ option.detail }}</span>
            </combobox-item>
          </combobox-viewport>
        </combobox-content>
      </combobox-portal>
    </autocomplete-root>
  </ui-form-field>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown } from '@lucide/vue'
import {
  AutocompleteInput,
  AutocompleteRoot,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxItem,
  ComboboxPortal,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import UiFormField from '@/components/common/form/UiFormField.vue'
import type { TUiComboOption } from '@/components/common/form/types/TUiComboOption'

@Component({
  components: {
    AutocompleteInput,
    AutocompleteRoot,
    ChevronDown,
    ComboboxAnchor,
    ComboboxContent,
    ComboboxItem,
    ComboboxPortal,
    ComboboxTrigger,
    ComboboxViewport,
    UiFormField,
  },
  emits: ['update:modelValue'],
})
export default class UiComboField extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: '' })
  public readonly modelValue?: string

  @Prop({ required: false, default: () => [] })
  public readonly options?: TUiComboOption[]

  @Prop({ required: false, default: '' })
  public readonly error?: string

  @Prop({ required: false, default: '' })
  public readonly placeholder?: string

  @Prop({ required: false, default: false, type: Boolean })
  public readonly disabled?: boolean

  public expanded = false

  public get text(): string {
    return this.modelValue ?? ''
  }

  public set text(value: string) {
    this.$emit('update:modelValue', value)
  }

  public get hasOptions(): boolean {
    return (this.options ?? []).length > 0
  }

  // reka closes its list from a window listener, after the modal's document listener has already closed the whole dialog.
  public closeOnEscape(event: KeyboardEvent): void {
    if (!this.expanded) {
      return
    }

    event.stopPropagation()
    this.expanded = false
  }
}
</script>
