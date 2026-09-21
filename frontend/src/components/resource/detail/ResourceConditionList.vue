<template>
  <ul class="space-y-1.5">
    <li v-for="condition in conditions" :key="condition.type" class="flex items-baseline gap-2 text-xs">
      <ui-status-dot :label="condition.status" :tone="condition.tone" class="translate-y-px shrink-0" />

      <span class="w-32 shrink-0 truncate text-foreground">{{ condition.type }}</span>
      <span class="w-12 shrink-0 text-muted-foreground">{{ condition.status }}</span>
      <span class="min-w-0 flex-1 truncate text-muted-foreground" :title="conditionTitle(condition)">
        {{ conditionTitle(condition) }}
      </span>
    </li>
  </ul>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TDetailCondition } from '@/components/resource/detail/types/TDetailCondition'

@Component({
  components: { UiStatusDot },
})
export default class ResourceConditionList extends VueBase {
  @Prop({ required: true })
  public readonly conditions: TDetailCondition[]

  public conditionTitle(condition: TDetailCondition): string {
    return condition.message || condition.reason
  }
}
</script>
