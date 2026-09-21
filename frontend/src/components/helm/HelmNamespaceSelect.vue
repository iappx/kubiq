<template>
  <select
      :value="modelValue"
      aria-label="Filter releases by namespace"
      class="ui-input h-7 w-40 text-xs"
      title="Filter releases by namespace"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option value="">All namespaces</option>
    <option v-for="namespace in namespaces" :key="namespace" :value="namespace">{{ namespace }}</option>
  </select>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({
  emits: ['update:modelValue'],
})
export default class HelmNamespaceSelect extends VueBase {
  @Prop({ required: false, default: '' })
  public readonly modelValue?: string

  @Prop({ required: false, default: () => [] })
  public readonly namespaces?: string[]
}
</script>
