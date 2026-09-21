<template>
  <div class="flex gap-1 mb-6 border-b border-border">
    <button
        v-for="t in tabs"
        :key="t.key"
        :class="['ui-tab rounded-b-none', active === t.key ? 'ui-tab-active' : '']"
        @click="$emit('change', t.key)"
    >{{ t.label }}
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

export type TTab = {
  key: string
  label: string
}

@Component({
  emits: ['change'],
})
export default class UiTabBar extends VueBase {
  @Prop({ type: Array, required: true })
  public readonly tabs: TTab[]

  @Prop({ type: String, required: true })
  public readonly active: string
}
</script>
