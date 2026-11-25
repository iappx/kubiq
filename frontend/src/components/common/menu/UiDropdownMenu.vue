<template>
  <dropdown-menu-root v-model:open="isOpen">
    <dropdown-menu-trigger as-child>
      <slot name="trigger" />
    </dropdown-menu-trigger>

    <dropdown-menu-portal>
      <dropdown-menu-content :align="align" :side-offset="4" class="ui-menu">
        <template v-for="item in items" :key="item.key">
          <dropdown-menu-separator v-if="item.separatorBefore" class="ui-menu-separator" />
          <dropdown-menu-label
              v-if="item.groupLabel"
              class="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none"
          >
            {{ item.groupLabel }}
          </dropdown-menu-label>
          <dropdown-menu-item
              :class="['ui-menu-item', item.danger ? 'ui-menu-item-danger' : '']"
              :title="item.hint"
              @select="$emit('select', item.key)"
          >
            <slot :item="item" name="item-leading">
              <ui-status-dot v-if="item.tone" :size="8" :tone="item.tone" />
              <component :is="item.icon" v-if="item.icon" :size="14" aria-hidden="true" />
            </slot>
            <span class="truncate">{{ item.label }}</span>
          </dropdown-menu-item>
        </template>
      </dropdown-menu-content>
    </dropdown-menu-portal>
  </dropdown-menu-root>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    UiStatusDot,
  },
  emits: ['select'],
})
export default class UiDropdownMenu extends VueBase {
  @Prop({ required: true })
  public readonly items: TUiMenuItem[]

  @Prop({ required: false, default: 'end' })
  public readonly align?: 'start' | 'center' | 'end'

  public isOpen = false

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
    this.escapeToken ??= Symbol('dropdown-menu')
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
