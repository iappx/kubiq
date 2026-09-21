<template>
  <ui-form-field v-slot="{ fieldId, describedBy }" :error="error" :label="label">
    <input
        :id="fieldId"
        :aria-describedby="describedBy"
        :aria-invalid="error ? 'true' : undefined"
        :disabled="disabled"
        :placeholder="placeholder"
        :value="modelValue"
        class="ui-input h-9 text-sm"
        type="text"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </ui-form-field>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiFormField from '@/components/common/form/UiFormField.vue'

@Component({
  components: { UiFormField },
  emits: ['update:modelValue'],
})
export default class HelmTextField extends VueBase {
  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: false, default: '' })
  public readonly modelValue?: string

  @Prop({ required: false, default: '' })
  public readonly placeholder?: string

  @Prop({ required: false, default: '' })
  public readonly error?: string

  @Prop({ required: false, default: false })
  public readonly disabled?: boolean
}
</script>
