<template>
  <dropdown-menu-root v-model:open="isOpen" :modal="false">
    <!-- The menu opens at a point, not from a control, so reka measures this zero-size anchor instead. -->
    <dropdown-menu-trigger
        :style="{ left: `${x}px`, top: `${y}px` }"
        aria-hidden="true"
        class="fixed w-px h-px p-0 opacity-0 pointer-events-none"
        tabindex="-1"
        type="button"
    />

    <dropdown-menu-portal>
      <dropdown-menu-content
          :side-offset="0"
          align="start"
          class="ui-menu"
          @close-auto-focus="onCloseAutoFocus"
      >
        <template v-for="item in items" :key="item.key">
          <dropdown-menu-separator v-if="item.separatorBefore" class="ui-menu-separator" />
          <dropdown-menu-item
              :class="['ui-menu-item', item.danger ? 'ui-menu-item-danger' : '']"
              @select="$emit('select', item.key)"
          >
            <component :is="item.icon" v-if="item.icon" :size="14" aria-hidden="true" />
            <span class="truncate">{{ item.label }}</span>
          </dropdown-menu-item>
        </template>
      </dropdown-menu-content>
    </dropdown-menu-portal>
  </dropdown-menu-root>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

@Component({
  components: {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  },
  emits: ['select', 'closed'],
})
export default class UiContextMenu extends VueBase {
  @Prop({ required: true })
  public readonly items: TUiMenuItem[]

  @Prop({ required: false, default: 0 })
  public readonly x?: number

  @Prop({ required: false, default: 0 })
  public readonly y?: number

  @VModel({ name: 'open' })
  public isOpen: boolean

  public onCloseAutoFocus(event: Event): void {
    // Default restoration would focus the invisible anchor; the owner restores focus instead.
    event.preventDefault()
    this.$emit('closed')
  }
}
</script>
