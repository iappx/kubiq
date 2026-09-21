<template>
  <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Filter charts by repository">
    <button
        :aria-pressed="selected === ''"
        :class="['pill', selected === '' ? 'pill-active' : '']"
        type="button"
        @click="$emit('select', '')"
    >All repositories</button>

    <button
        v-for="name in names"
        :key="name"
        :aria-pressed="selected === name"
        :class="['pill', selected === name ? 'pill-active' : '']"
        type="button"
        @click="$emit('select', name)"
    >{{ name }}</button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({
  emits: ['select'],
})
export default class HelmRepositoryFilter extends VueBase {
  @Prop({ required: true })
  public readonly names: string[]

  @Prop({ required: false, default: '' })
  public readonly selected?: string
}
</script>
