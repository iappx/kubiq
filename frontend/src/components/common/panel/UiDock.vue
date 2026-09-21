<template>
  <section
      :aria-label="label"
      :style="{ height: collapsed ? `${stripHeight}px` : `${height}px` }"
      class="ui-dock relative flex min-h-0 shrink-0 flex-col border-t border-border bg-background"
  >
    <ui-resize-handle
        v-if="!collapsed"
        v-model:value="dockHeight"
        :max="maxHeight"
        :min="minHeight"
        class="absolute inset-x-0 top-0 z-10"
        invert
        label="Resize dock"
        orientation="horizontal"
    />

    <div class="flex items-center gap-1 px-2 shrink-0 overflow-x-auto" :style="{ height: `${stripHeight}px` }">
      <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="['flex items-center rounded-md shrink-0', tab.key === active ? 'ui-tab-active' : '']"
      >
        <button
            :aria-current="tab.key === active ? 'true' : undefined"
            class="ui-tab px-2 py-1 text-xs bg-transparent"
            type="button"
            @click="select(tab.key)"
        >
          {{ tab.label }}
        </button>
        <button
            v-if="tab.closable !== false"
            :aria-label="`Close ${tab.label}`"
            :title="`Close ${tab.label}`"
            class="btn-icon w-7 h-7 mr-1"
            type="button"
            @click="$emit('close-tab', tab.key)"
        >
          <x :size="12" />
        </button>
      </div>

      <div class="ml-auto flex items-center gap-1 pl-2">
        <slot name="actions" />
        <button
            :aria-expanded="!collapsed"
            :aria-label="collapsed ? 'Expand dock' : 'Collapse dock'"
            :title="collapsed ? 'Expand dock' : 'Collapse dock'"
            class="btn-icon w-7 h-7"
            type="button"
            @click="$emit('update:collapsed', !collapsed)"
        >
          <chevron-up v-if="collapsed" :size="14" />
          <chevron-down v-else :size="14" />
        </button>
      </div>
    </div>

    <div v-if="!collapsed" class="flex-1 min-h-0 overflow-auto border-t border-border">
      <slot />
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ChevronDown, ChevronUp, X } from '@lucide/vue'
import UiResizeHandle from '@/components/common/panel/UiResizeHandle.vue'
import type { TUiDockTab } from '@/components/common/panel/types/TUiDockTab'

@Component({
  components: { ChevronDown, ChevronUp, UiResizeHandle, X },
  emits: ['close-tab', 'update:active', 'update:collapsed', 'update:height'],
})
export default class UiDock extends VueBase {
  public static readonly stripHeightPx = 32

  public static readonly minHeightPx = 120

  public static readonly maxHeightPx = 640

  @Prop({ required: true })
  public readonly tabs: TUiDockTab[]

  @Prop({ required: true })
  public readonly active: string | null

  @Prop({ required: true })
  public readonly collapsed: boolean

  @Prop({ required: true })
  public readonly height: number

  @Prop({ required: false, default: 'Logs and shells' })
  public readonly label?: string

  @Prop({ required: false, default: UiDock.minHeightPx })
  public readonly minHeight?: number

  @Prop({ required: false, default: UiDock.maxHeightPx })
  public readonly maxHeight?: number

  public get stripHeight(): number {
    return UiDock.stripHeightPx
  }

  public get dockHeight(): number {
    return this.height
  }

  public set dockHeight(value: number) {
    this.$emit('update:height', value)
  }

  public select(key: string): void {
    if (key !== this.active) {
      this.$emit('update:active', key)
    }
  }
}
</script>

<style scoped>
.ui-dock {
  transition: height var(--motion-moderate) var(--ease-standard);
}
</style>
