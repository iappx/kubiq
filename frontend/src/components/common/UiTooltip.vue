<template>
  <tooltip-provider :delay-duration="delay" :skip-delay-duration="0">
    <tooltip-root>
      <tooltip-trigger as-child>
        <slot />
      </tooltip-trigger>
      <tooltip-portal>
        <tooltip-content
            :side="side"
            :side-offset="4"
            class="ui-tooltip data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {{ text }}
        </tooltip-content>
      </tooltip-portal>
    </tooltip-root>
  </tooltip-provider>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

@Component({
  components: { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger },
})
export default class UiTooltip extends VueBase {
  @Prop({ required: true })
  public readonly text: string

  @Prop({ required: false, default: 'top' })
  public readonly side?: 'top' | 'right' | 'bottom' | 'left'

  @Prop({ required: false, default: 400 })
  public readonly delay?: number
}
</script>
