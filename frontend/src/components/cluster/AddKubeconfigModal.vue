<template>
  <ui-modal
      v-model="isOpen"
      :loading="busy"
      submit-label="Add"
      title="Add kubeconfig"
      @close="$emit('close')"
      @submit="submit"
  >
    <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.path" label="Kubeconfig file path">
      <input
          :id="fieldId"
          ref="field"
          v-model="draft.path"
          :aria-describedby="describedBy"
          :aria-invalid="errors.path ? 'true' : undefined"
          autocomplete="off"
          class="ui-input w-full"
          placeholder="D:/work/clusters/staging.yaml"
          spellcheck="false"
          type="text"
          @keydown.enter.prevent="submit"
      >
    </ui-form-field>

    <p class="text-xs text-muted-foreground mt-3">
      Kubiq reads the file where it is and never copies it. Environment variables such as
      <code class="text-foreground">$HOME</code> are expanded.
    </p>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import { KubeconfigSourceValidator } from '@/application/validators/KubeconfigSourceValidator'
import type { TKubeconfigSourceDraft } from '@/domain/entities/catalog/types/TKubeconfigSourceDraft'

@Component({
  components: { UiFormField, UiModal },
  emits: ['close', 'submit'],
})
export default class AddKubeconfigModal extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public draft: TKubeconfigSourceDraft = { path: '' }

  public errors: Record<string, string> = {}

  constructor(
      @inject(KubeconfigSourceValidator) private readonly validator: KubeconfigSourceValidator,
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
      this.draft = { path: '' }
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
      this.$emit('submit', this.draft.path.trim())
    }
  }
}
</script>
