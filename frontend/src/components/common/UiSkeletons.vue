<template>
  <div>
    <div v-if="type === 'cards'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in count" :key="i" class="surface p-5 space-y-4">
        <div class="flex items-start justify-between">
          <div class="w-10 h-10 rounded-md shimmer" />
          <div class="flex gap-1">
            <div class="w-7 h-7 rounded-md shimmer" />
            <div class="w-7 h-7 rounded-md shimmer" />
          </div>
        </div>
        <div class="w-3/4 h-5 rounded shimmer" />
        <div class="w-1/2 h-3 rounded shimmer" />
      </div>
    </div>

    <div v-else class="surface divide-y divide-border">
      <div v-for="i in count" :key="i" class="flex items-center gap-3 px-5 py-4">
        <div class="w-5 h-5 rounded shimmer" />
        <div class="flex-1 h-5 max-w-sm rounded shimmer" />
        <div class="w-7 h-7 rounded-md ml-auto shimmer" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'

@Component({})
export default class UiSkeletons extends VueBase {
  @Prop({ required: false, default: 'cards' })
  public readonly type?: 'cards' | 'rows'

  @Prop({ required: false, default: 3 })
  public readonly count?: number
}
</script>
