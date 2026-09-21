<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
          v-if="open"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
            class="absolute inset-0 bg-foreground/20"
            @click="!loading && $emit('cancel')"
        />
        <div
            ref="panel"
            :aria-describedby="descriptionId"
            :aria-labelledby="titleId"
            aria-modal="true"
            class="surface-raised p-6 w-full max-w-sm relative z-10 modal-panel"
            role="alertdialog"
        >
          <div class="flex items-start gap-4 mb-5">
            <div
                :class="[
                  'w-10 h-10 rounded-md flex items-center justify-center shrink-0',
                  variant === 'danger' ? 'bg-destructive/10' : 'bg-warning/10',
                ]"
            >
              <triangle-alert
                  :class="variant === 'danger' ? 'text-destructive' : 'text-warning'"
                  :size="20"
              />
            </div>
            <div>
              <h3 :id="titleId" class="font-semibold text-foreground mb-1">{{ title }}</h3>
              <p :id="descriptionId" class="text-sm text-muted-foreground">{{ description }}</p>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button
                :disabled="loading"
                class="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                @click="$emit('cancel')"
            >
              Cancel
            </button>
            <button
                :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
                :disabled="loading"
                class="disabled:opacity-70 disabled:cursor-not-allowed"
                type="button"
                @click="$emit('confirm')"
            >
              <loader-circle v-if="loading" :size="14" class="animate-spin" />
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import { TriangleAlert, LoaderCircle } from '@lucide/vue'
import { Component, Prop, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { ModalShellBase } from '@/components/base/modals/ModalShellBase'

@Component({
  components: { TriangleAlert, LoaderCircle },
  emits: ['confirm', 'cancel'],
})
export default class ConfirmDialog extends ModalShellBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly title: string

  @Prop({ required: true })
  public readonly description: string

  @Prop({ required: false, default: 'Delete' })
  public readonly confirmLabel?: string

  @Prop({ required: false, default: 'danger' })
  public readonly variant?: 'danger' | 'warning'

  @Prop({ required: false, default: false })
  public readonly loading?: boolean

  public titleId = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  public get descriptionId(): string {
    return `${this.titleId}-description`
  }

  created(): void {
    this.titleId = `confirm-title-${this.idService.next()}`
  }

  @Watch('open')
  openChanged(open: boolean): void {
    void this.handleOpenChange(open)
  }

  protected isOpen(): boolean {
    return this.open
  }

  protected onEscape(): void {
    if (!this.loading) {
      this.$emit('cancel')
    }
  }
}
</script>
