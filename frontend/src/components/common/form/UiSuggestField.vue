<template>
  <ui-form-field v-slot="{ fieldId, describedBy }" :error="error" :label="label">
    <input
        :id="fieldId"
        :aria-describedby="describedBy"
        :aria-invalid="error ? 'true' : undefined"
        :disabled="disabled"
        :list="`${fieldId}-options`"
        :placeholder="placeholder"
        :value="modelValue"
        class="ui-input"
        type="text"
        @change="$emit('change')"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <datalist :id="`${fieldId}-options`">
      <option v-for="option in options" :key="option" :value="option" />
    </datalist>
  </ui-form-field>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiFormField from '@/components/common/form/UiFormField.vue'

@Component({
  components: { UiFormField },
  emits: ['update:modelValue', 'change'],
})
export default class UiSuggestField extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: '' })
  public readonly modelValue?: string

  @Prop({ required: false, default: () => [] })
  public readonly options?: string[]

  @Prop({ required: false, default: '' })
  public readonly error?: string

  @Prop({ required: false, default: '' })
  public readonly placeholder?: string

  @Prop({ required: false, default: false, type: Boolean })
  public readonly disabled?: boolean
}
</script>
