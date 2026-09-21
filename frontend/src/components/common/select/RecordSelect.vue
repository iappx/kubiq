<template>
  <ui-select
      v-model="value"
      :allow-clear="clearable"
      :items="items"
      :placeholder="placeholder"
      item-key="key"
      item-title="value"
  />
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase } from '@iappx/vue-facing-di'
import UiSelect from '@/components/common/select/UiSelect.vue'

@Component({
  components: { UiSelect },
})
export default class RecordSelect extends VueBase {
  @Prop({ required: true })
  public readonly values: Record<string, any>

  @Prop({})
  public readonly clearable: boolean

  @Prop({ required: false })
  public readonly placeholder?: string

  @VModel()
  public readonly value: string

  get items(): Record<string, any>[] {
    const keys = Object.keys(this.values)
    const result: Record<string, any>[] = []
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      result.push({ key, value: this.values[key] })
    }
    return result
  }
}
</script>
