<template>
  <transition>
    <motion-div
        v-if="open"
        :animate="{ x: 0, opacity: 1 }"
        :aria-label="label"
        :exit="{ x: 24, opacity: 0, transition: { duration: moderate, ease: easeIn } }"
        :initial="{ x: 24, opacity: 0 }"
        :style="{ width: `${width}px` }"
        :transition="{ duration: moderate, ease: easeOut }"
        class="relative h-full min-h-0 shrink-0 border-l border-border bg-background"
        role="region"
    >
      <ui-resize-handle
          v-model:value="panelWidth"
          :max="maxWidth"
          :min="minWidth"
          class="absolute inset-y-0 left-0 z-10"
          invert
          label="Resize details panel"
          orientation="vertical"
      />

      <div ref="panel" class="flex h-full min-h-0 flex-col">
        <header class="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
          <div class="min-w-0">
            <h2 autofocus class="text-sm font-semibold text-foreground truncate" tabindex="-1">
              <slot name="title">{{ label }}</slot>
            </h2>
            <p v-if="$slots.subtitle" class="text-xs text-muted-foreground truncate mt-1">
              <slot name="subtitle" />
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <slot name="actions" />
            <button
                aria-label="Close details"
                class="btn-icon w-7 h-7"
                title="Close details"
                type="button"
                @click="$emit('close')"
            >
              <x :size="14" />
            </button>
          </div>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="px-4 py-3 border-t border-border">
          <slot name="footer" />
        </footer>
      </div>
    </motion-div>
  </transition>
</template>

<script lang="ts">
import { Component, Prop, Watch } from '@iappx/vue-facing-di'
import { motion } from 'motion-v'
import { X } from '@lucide/vue'
import { ModalShellBase } from '@/components/base/modals/ModalShellBase'
import UiResizeHandle from '@/components/common/panel/UiResizeHandle.vue'
import { UiMotion } from '@/constants/UiMotion'

@Component({
  components: { MotionDiv: motion.div, UiResizeHandle, X },
  emits: ['close', 'update:width'],
})
export default class UiSidePanel extends ModalShellBase {
  public static readonly minWidthPx = 420

  public static readonly maxWidthPx = 880

  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: UiSidePanel.minWidthPx })
  public readonly minWidth?: number

  @Prop({ required: false, default: UiSidePanel.maxWidthPx })
  public readonly maxWidth?: number

  public get panelWidth(): number {
    return this.width
  }

  public set panelWidth(value: number) {
    this.$emit('update:width', value)
  }

  public get moderate(): number {
    return UiMotion.moderate
  }

  public get easeOut(): [number, number, number, number] {
    return UiMotion.easeOut
  }

  public get easeIn(): [number, number, number, number] {
    return UiMotion.easeIn
  }

  @Watch('open')
  openChanged(open: boolean): void {
    void this.handleOpenChange(open)
  }

  protected isOpen(): boolean {
    return this.open
  }

  protected onEscape(): void {
    this.$emit('close')
  }
}
</script>
