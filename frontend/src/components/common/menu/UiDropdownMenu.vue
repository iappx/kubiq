<template>
  <dropdown-menu-root v-model:open="isOpen">
    <dropdown-menu-trigger as-child>
      <slot name="trigger" />
    </dropdown-menu-trigger>

    <dropdown-menu-portal>
      <dropdown-menu-content :align="align" :side-offset="4" class="ui-menu">
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
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
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
  emits: ['select'],
})
export default class UiDropdownMenu extends VueBase {
  @Prop({ required: true })
  public readonly items: TUiMenuItem[]

  @Prop({ required: false, default: 'end' })
  public readonly align?: 'start' | 'center' | 'end'

  public isOpen = false
}
</script>
