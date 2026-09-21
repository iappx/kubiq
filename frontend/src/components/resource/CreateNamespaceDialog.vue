<template>
  <ui-modal
      :loading="busy"
      :open="open"
      submit-label="Create"
      title="Create namespace"
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        A namespace is created empty. For anything richer than a name, use Create from YAML in the toolbar.
      </p>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.name" label="Name">
        <input
            :id="fieldId"
            v-model="draft.name"
            :aria-describedby="describedBy"
            :aria-invalid="errors.name ? 'true' : undefined"
            autocomplete="off"
            class="ui-input"
            spellcheck="false"
            type="text"
            @keydown.enter.prevent="submit"
        >
      </ui-form-field>
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import { NamespaceDraftValidator } from '@/application/validators/NamespaceDraftValidator'
import type { TNamespaceDraft } from '@/domain/entities/cluster/types/TNamespaceDraft'

@Component({
  components: { UiFormField, UiModal },
  emits: ['confirm', 'cancel'],
})
export default class CreateNamespaceDialog extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public draft: TNamespaceDraft = { name: '' }

  public errors: Record<string, string> = {}

  constructor(
      @inject(NamespaceDraftValidator) private readonly validator: NamespaceDraftValidator,
  ) {
    super()
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.reset()
    }
  }

  public submit(): void {
    const result = this.validator.validate(this.draft)
    this.errors = result.errors

    if (result.valid) {
      this.$emit('confirm', NamespaceDraftValidator.parse(this.draft))
    }
  }

  private reset(): void {
    this.draft = { name: '' }
    this.errors = {}
  }
}
</script>
