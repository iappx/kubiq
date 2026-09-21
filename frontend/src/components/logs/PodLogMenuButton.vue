<template>
  <ui-dropdown-menu :items="items" align="start" @select="$emit('select', $event)">
    <template #trigger>
      <button :aria-label="label" :title="label" class="pod-log-trigger" type="button">
        <span class="truncate">{{ value }}</span>
        <chevron-down :size="12" class="shrink-0 opacity-60" />
      </button>
    </template>
  </ui-dropdown-menu>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown } from '@lucide/vue'
import UiDropdownMenu from '@/components/common/menu/UiDropdownMenu.vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

@Component({
  components: { ChevronDown, UiDropdownMenu },
  emits: ['select'],
})
export default class PodLogMenuButton extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly value: string

  @Prop({ required: true })
  public readonly items: TUiMenuItem[]
}
</script>

<style scoped>
.pod-log-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  max-width: 180px;
  padding-inline: 8px;
  border-radius: 6px;
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 12px;
  transition: background-color var(--motion-instant) var(--ease-standard);
}

.pod-log-trigger:hover {
  background-color: hsl(var(--muted));
}
</style>
