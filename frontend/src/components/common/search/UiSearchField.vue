<template>
  <div class="relative flex items-center">
    <search :size="14" aria-hidden="true" class="absolute left-2 text-muted-foreground pointer-events-none" />
    <input
        ref="field"
        :aria-label="placeholder"
        :placeholder="placeholder"
        :value="text"
        class="ui-input h-7 pl-7 pr-7 text-xs"
        type="search"
        @input="onInput"
        @keydown.escape.stop="clear"
    >
    <button
        v-if="text"
        aria-label="Clear filter"
        class="absolute right-0 inline-flex items-center justify-center w-7 h-7 rounded-sm text-muted-foreground hover:text-foreground"
        title="Clear filter"
        type="button"
        @click="clear"
    >
      <x :size="12" />
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, VueBase } from '@iappx/vue-facing-di'
import { Search, X } from '@lucide/vue'

@Component({
  components: { Search, X },
  emits: ['update:modelValue'],
})
export default class UiSearchField extends VueBase {
  public static readonly debounceMs = 150

  @Prop({ required: false, default: '' })
  public readonly modelValue?: string

  @Prop({ required: false, default: 'Filter' })
  public readonly placeholder?: string

  @Prop({ required: false })
  public readonly shortcut?: string

  public text = ''

  private timer: ReturnType<typeof setTimeout> | null = null

  private onShortcut!: (event: KeyboardEvent) => void

  @Watch('modelValue')
  modelValueChanged(value: string): void {
    if (value !== this.text) {
      this.text = value
    }
  }

  created(): void {
    this.text = this.modelValue ?? ''

    this.onShortcut = event => {
      if (!this.shortcut || event.key !== this.shortcut || this.isTyping(event.target)) {
        return
      }
      event.preventDefault()
      this.focus()
    }

    document.addEventListener('keydown', this.onShortcut)
  }

  beforeUnmount(): void {
    document.removeEventListener('keydown', this.onShortcut)
    this.cancel()
  }

  public focus(): void {
    const field = this.$refs.field as HTMLInputElement | undefined
    field?.focus()
    field?.select()
  }

  public clear(): void {
    this.text = ''
    this.cancel()
    this.$emit('update:modelValue', '')
  }

  public onInput(event: Event): void {
    this.text = (event.target as HTMLInputElement).value
    this.cancel()
    this.timer = setTimeout(() => {
      this.timer = null
      this.$emit('update:modelValue', this.text)
    }, UiSearchField.debounceMs)
  }

  private cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null
    if (!element) {
      return false
    }
    const tag = element.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable
  }
}
</script>
