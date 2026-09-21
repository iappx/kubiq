<template>
  <span
      v-if="refused"
      :title="hint"
      class="pill gap-1 text-warning border-warning/30 bg-warning/10"
      role="status"
  >
    Namespaces not listable
  </span>

  <ui-multi-select
      v-else
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
import { KubeAccessHint } from '@/domain/models/kube'

@Component({
  components: { UiMultiSelect },
  emits: ['update:selected'],
})
export default class NamespaceScope extends VueBase {
  @Prop({ required: false, default: () => [] })
  public readonly selected?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly available?: string[]

  @Prop({ required: false, default: false })
  public readonly forbidden?: boolean

  public get options(): TUiSelectOption[] {
    return (this.available ?? []).map(name => ({ key: name, title: name }))
  }

  public get refused(): boolean {
    return this.forbidden === true && this.options.length === 0
  }

  public get hint(): string {
    return `The cluster will not list its namespaces for you, so every screen stays cluster-wide. ${
      KubeAccessHint.forResource('list', 'namespaces')}`
  }
}
</script>
