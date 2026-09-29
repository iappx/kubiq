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
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

@Component({
  components: { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger },
})
export default class UiPopover extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: 'end' })
  public readonly align?: 'start' | 'center' | 'end'

  @VModel({ name: 'open' })
  public isOpen: boolean
}
</script>
