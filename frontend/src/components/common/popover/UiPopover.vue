<template>
  <popover-root v-model:open="isOpen">
    <popover-trigger as-child>
      <slot name="trigger" />
    </popover-trigger>

    <popover-portal>
      <popover-content
          :align="align"
          :aria-label="label"
          :collision-padding="16"
          :side-offset="4"
          class="ui-popover"
      >
        <slot />
      </popover-content>
    </popover-portal>
  </popover-root>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase, Watch } from '@iappx/vue-facing-di'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ModalEscapeStack } from '@/components/base/modals/ModalEscapeStack'

@Component({
  components: { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger },
})
export default class UiPopover extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: 'end' })
  public readonly align?: 'start' | 'center' | 'end'

  @VModel({ name: 'open', type: Boolean })
  public isOpen: boolean

  private escapeToken: symbol | null = null

  @Watch('isOpen')
  openChanged(open: boolean): void {
    if (open) {
      this.registerEscape()
    } else {
      this.unregisterEscape()
    }
  }

  mounted(): void {
    if (this.isOpen) {
      this.registerEscape()
    }
  }

  beforeUnmount(): void {
    this.unregisterEscape()
  }

  private registerEscape(): void {
    this.escapeToken ??= Symbol('popover')
    ModalEscapeStack.push(this.escapeToken, 'modal', () => {
      if (this.isOpen) {
        this.isOpen = false
      }
    })
  }

  private unregisterEscape(): void {
    if (this.escapeToken) {
      ModalEscapeStack.remove(this.escapeToken)
    }
  }
}
</script>
