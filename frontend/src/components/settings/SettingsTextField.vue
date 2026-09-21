<template>
  <div class="space-y-1.5">
    <ui-form-field v-slot="{ fieldId, describedBy }" :error="error" :label="label">
      <input
          :id="fieldId"
          v-model="draft"
          :aria-describedby="describedBy || hintId"
          :aria-invalid="error ? 'true' : undefined"
          :placeholder="placeholder"
          autocomplete="off"
          class="ui-input"
          spellcheck="false"
          type="text"
          @blur="commit"
          @keydown.enter.prevent="commit"
      >
    </ui-form-field>

    <p v-if="hint" :id="hintId" class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiFormField from '@/components/common/form/UiFormField.vue'
import { IdService } from '@/application/services/id/IdService'

@Component({
  components: { UiFormField },
})
export default class SettingsTextField extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: '' })
  public readonly placeholder?: string

  @Prop({ required: false, default: '' })
  public readonly hint?: string

  @Prop({ required: false, default: '' })
  public readonly error?: string

  @VModel()
  public value: string

  public draft = ''

  public hintId = ''

  constructor(
      @inject(IdService) private readonly idService: IdService,
  ) {
    super()
  }

  created(): void {
    this.hintId = `hint-${this.idService.next()}`
    this.draft = this.value
  }

  @Watch('value')
  valueChanged(value: string): void {
    this.draft = value
  }

  public commit(): void {
    const next = this.draft.trim()
    this.draft = next

    if (next !== this.value) {
      this.value = next
    }
  }
}
</script>
