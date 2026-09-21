<template>
  <ui-multi-select
      :model-value="selected"
      :options="options"
      class="w-56"
      label="Namespaces in scope"
      placeholder="All namespaces"
      @update:model-value="$emit('update:selected', $event)"
  />
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiMultiSelect from '@/components/common/select/UiMultiSelect.vue'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'

@Component({
  components: { UiMultiSelect },
  emits: ['update:selected'],
})
export default class NamespaceScope extends VueBase {
  @Prop({ required: false, default: () => [] })
  public readonly selected?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly available?: string[]

  public get options(): TUiSelectOption[] {
    return (this.available ?? []).map(name => ({ key: name, title: name }))
  }
}
</script>
