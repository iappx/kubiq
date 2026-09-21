<template>
  <ui-form-field v-slot="{ fieldId, describedBy }" :error="error" label="Namespace">
    <input
        :id="fieldId"
        :aria-describedby="describedBy"
        :aria-invalid="error ? 'true' : undefined"
        :disabled="disabled"
        :list="`${fieldId}-known`"
        :value="modelValue"
        class="ui-input h-9 text-sm"
        placeholder="default"
        type="text"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <datalist :id="`${fieldId}-known`">
      <option v-for="namespace in namespaces" :key="namespace" :value="namespace" />
    </datalist>
  </ui-form-field>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiFormField from '@/components/common/form/UiFormField.vue'

@Component({
  components: { UiFormField },
  emits: ['update:modelValue'],
})
export default class HelmNamespaceField extends VueBase {
  @Prop({ required: false, default: '' })
  public readonly modelValue?: string

  @Prop({ required: false, default: () => [] })
  public readonly namespaces?: string[]

  @Prop({ required: false, default: '' })
  public readonly error?: string

  @Prop({ required: false, default: false })
  public readonly disabled?: boolean
}
</script>
