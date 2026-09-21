<template>
  <dl class="grid gap-y-1.5 text-xs" style="grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr)">
    <template v-for="fact in facts" :key="fact.label">
      <dt class="text-muted-foreground truncate">{{ fact.label }}</dt>
      <dd class="min-w-0 break-all text-foreground tabular">
        <ui-age v-if="fact.isAge" :value="fact.value" />
        <template v-else>{{ fact.value || '—' }}</template>
      </dd>
    </template>
  </dl>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiAge from '@/components/common/time/UiAge.vue'
import type { THelmFact } from '@/components/helm/types/THelmFact'

@Component({
  components: { UiAge },
})
export default class HelmFactList extends VueBase {
  @Prop({ required: true })
  public readonly facts: THelmFact[]
}
</script>
