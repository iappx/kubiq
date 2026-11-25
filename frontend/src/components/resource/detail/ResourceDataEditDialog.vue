<template>
  <ui-modal
      :loading="busy"
      :open="open"
      :submit-label="submitLabel"
      :title="title"
      :wide="true"
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="space-y-3">
      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.key" label="Key">
        <input
            :id="fieldId"
            v-model="draft.key"
            :aria-describedby="describedBy"
            :aria-invalid="errors.key ? 'true' : undefined"
            :disabled="busy || keyLocked"
            autocomplete="off"
            class="ui-input font-mono text-xs"
            placeholder="app.properties"
            spellcheck="false"
            type="text"
            @keydown.enter.prevent="submit"
        >
        <p v-if="keyLocked" class="text-xs text-muted-foreground">
          Renaming a key requires update permission.
        </p>
      </ui-form-field>

      <ui-form-field v-slot="{ fieldId, describedBy }" :error="errors.value" label="Value">
        <textarea
            :id="fieldId"
            v-model="draft.value"
            :aria-describedby="describedBy"
            :aria-invalid="errors.value ? 'true' : undefined"
            :disabled="busy"
            class="ui-input font-mono text-xs"
            rows="8"
            spellcheck="false"
        />
      </ui-form-field>

      <p v-if="isSecret" class="text-xs text-muted-foreground">
        Stored base64-encoded in the Secret; enter the decoded plain-text value.
      </p>
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import type { TResourceDataEditDraft } from '@/application/services/resourceData/types/TResourceDataEditDraft'
import { ResourceDataKeyValidator } from '@/application/validators/ResourceDataKeyValidator'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'

@Component({
  components: { UiFormField, UiModal },
  emits: ['save', 'cancel'],
})
export default class ResourceDataEditDialog extends VueBase {
  @Prop({ required: true, type: Boolean })
  public readonly open: boolean

  @Prop({ required: true, type: Boolean })
  public readonly isSecret: boolean

  @Prop({ required: true })
  public readonly existingKeys: string[]

  @Prop({ required: false, default: '' })
  public readonly initialKey?: string

  @Prop({ required: false, default: '' })
  public readonly initialValue?: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly busy?: boolean

  @Prop({ required: false, type: Boolean, default: true })
  public readonly canRename?: boolean

  public draft: TResourceDataEditDraft = { key: '', value: '' }

  public errors: Record<string, string> = {}

  constructor(
      @inject(ResourceDataKeyValidator) private readonly validator: ResourceDataKeyValidator,
  ) {
    super()
  }

  public get isEdit(): boolean {
    return Boolean(this.initialKey)
  }

  public get keyLocked(): boolean {
    return this.isEdit && this.canRename === false
  }

  public get title(): string {
    return this.isEdit ? `Edit ${this.initialKey}` : 'Add key'
  }

  public get submitLabel(): string {
    return this.isEdit ? 'Save' : 'Add'
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.draft = {
        key: this.initialKey ?? '',
        value: this.initialValue ?? '',
        originalKey: this.initialKey || undefined,
      }
      this.errors = {}
    } else {
      this.draft = { key: '', value: '' }
      this.errors = {}
    }
  }

  public submit(): void {
    const payload: TResourceDataEditDraft = this.keyLocked
      ? { ...this.draft, key: this.initialKey ?? '' }
      : { ...this.draft }
    const result = this.validator.validate(payload, this.existingKeys)
    this.errors = result.errors

    if (result.valid) {
      this.$emit('save', payload)
    }
  }
}
</script>
