<template>
  <ui-modal
      v-model="isOpen"
      :loading="busy"
      submit-label="Add"
      title="Add a chart repository"
      @close="$emit('close')"
      @submit="submit"
  >
    <div class="space-y-3">
      <helm-text-field
          v-model="draft.name"
          :error="errors.name"
          label="Name"
          placeholder="bitnami"
      />

      <helm-text-field
          v-model="draft.url"
          :error="errors.url"
          label="Address"
          placeholder="https://charts.bitnami.com/bitnami"
      />
    </div>

    <p class="text-xs text-muted-foreground mt-3">
      The repository is added to the Helm configuration of this machine, so every tool that reads it sees it.
    </p>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, Watch, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiModal from '@/components/common/modal/UiModal.vue'
import HelmTextField from '@/components/helm/HelmTextField.vue'
import { HelmRepositoryValidator } from '@/application/validators/HelmRepositoryValidator'
import type { THelmRepositoryDraft } from '@/domain/entities/helm/types/THelmRepositoryDraft'

@Component({
  components: { HelmTextField, UiModal },
  emits: ['close', 'submit'],
})
export default class AddHelmRepositoryModal extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public draft: THelmRepositoryDraft = { name: '', url: '' }

  public errors: Record<string, string> = {}

  constructor(
      @inject(HelmRepositoryValidator) private readonly validator: HelmRepositoryValidator,
  ) {
    super()
  }

  public get isOpen(): boolean {
    return this.open
  }

  public set isOpen(value: boolean) {
    if (!value) {
      this.$emit('close')
    }
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.draft = { name: '', url: '' }
      this.errors = {}
    }
  }

  public submit(): void {
    if (this.busy) {
      return
    }

    const result = this.validator.validate(this.draft)
    this.errors = result.errors

    if (result.valid) {
      this.$emit('submit', { name: this.draft.name.trim(), url: this.draft.url.trim() })
    }
  }
}
</script>
