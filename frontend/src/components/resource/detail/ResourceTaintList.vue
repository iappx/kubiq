<template>
  <ul class="space-y-1.5">
    <li v-for="taint in taints" :key="`${taint.key}/${taint.effect}`" class="flex items-baseline gap-2 text-xs">
      <ui-status-dot :label="taint.effect" :tone="taint.tone" class="translate-y-px shrink-0" />

      <span class="min-w-0 flex-1 truncate text-foreground" :title="pairOf(taint)">{{ pairOf(taint) }}</span>
      <span class="shrink-0 text-muted-foreground">{{ taint.effect }}</span>
    </li>
  </ul>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TDetailTaint } from '@/components/resource/detail/types/TDetailTaint'

@Component({
  components: { UiStatusDot },
})
export default class ResourceTaintList extends VueBase {
  @Prop({ required: true })
  public readonly taints: TDetailTaint[]

  public pairOf(taint: TDetailTaint): string {
    return taint.value === '' ? taint.key : `${taint.key}=${taint.value}`
  }
}
</script>
