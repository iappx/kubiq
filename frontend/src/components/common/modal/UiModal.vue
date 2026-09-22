<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
          v-if="open"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
            class="absolute inset-0 bg-foreground/20"
            @click="!loading && $emit('close')"
        />
        <div
            ref="panel"
            :aria-labelledby="titleId"
            aria-modal="true"
            class="surface-raised p-6 w-full max-w-md relative z-10 modal-panel"
            role="dialog"
        >
          <div class="flex items-center justify-between mb-5">
            <h2 :id="titleId" class="text-base font-semibold text-foreground">{{ title }}</h2>
            <button aria-label="Close" class="btn-icon" type="button" @click="$emit('close')">
              <x :size="18" />
            </button>
          </div>

          <slot />

          <div class="flex justify-end gap-2 mt-6">
            <button
                :disabled="loading"
                class="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                @click="$emit('close')"
            >
              {{ cancelLabel }}
            </button>
            <button
                :disabled="loading"
                class="btn-primary disabled:opacity-70 disabled:cursor-not-allowed"
                type="button"
                @click="$emit('submit')"
            >
              <loader-circle v-if="loading" :size="14" class="animate-spin" />
              {{ submitLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import { Component, Prop, VModel, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { LoaderCircle, X } from '@lucide/vue'
import { IdService } from '@/application/services/id/IdService'
import { ModalShellBase } from '@/components/base/modals/ModalShellBase'

@Component({
  components: { X, LoaderCircle },
  emits: ['close', 'submit'],
})
export default class UiModal extends ModalShellBase {
  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: true })
  public readonly submitLabel: string

  @Prop({ required: false, default: 'Cancel' })
  public readonly cancelLabel?: string

  @Prop({ required: false })
  public readonly loading?: boolean

  @VModel()
  public open: boolean

  public titleId = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.titleId = `modal-title-${this.idService.next()}`
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
