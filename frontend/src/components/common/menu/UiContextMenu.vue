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
              :title="item.hint"
              @select="$emit('select', item.key)"
          >
            <ui-status-dot v-if="item.tone" :size="8" :tone="item.tone" />
            <component :is="item.icon" v-if="item.icon" :size="14" aria-hidden="true" />
            <span class="truncate">{{ item.label }}</span>
          </dropdown-menu-item>
        </template>
      </dropdown-menu-content>
    </dropdown-menu-portal>
  </dropdown-menu-root>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase, Watch } from '@iappx/vue-facing-di'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { ModalEscapeStack } from '@/components/base/modals/ModalEscapeStack'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

@Component({
  components: {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    UiStatusDot,
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

  public onCloseAutoFocus(event: Event): void {
    // Default restoration would focus the invisible anchor; the owner restores focus instead.
    event.preventDefault()
    this.$emit('closed')
  }

  private registerEscape(): void {
    this.escapeToken ??= Symbol('context-menu')
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
