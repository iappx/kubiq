<template>
  <ui-section :description="description" title="Nodes">
    <template #actions>
      <router-link v-if="path" :to="path" class="text-xs text-primary hover:underline">Open Nodes</router-link>
    </template>

    <p v-if="health.error" class="text-sm text-muted-foreground">{{ health.error }}</p>

    <p v-else-if="health.issues.length === 0" class="text-sm text-muted-foreground">
      Every node reports Ready, uncordoned and under no pressure.
    </p>

    <ul v-else class="space-y-2">
      <li v-for="issue in health.issues" :key="issue.name" class="flex items-center gap-2 min-w-0">
        <ui-status-dot :size="8" :tone="issue.state" />
        <span class="text-sm text-foreground truncate">{{ issue.name }}</span>
        <span class="ml-auto text-xs text-muted-foreground truncate">{{ issue.detail }}</span>
      </li>
    </ul>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiSection from '@/components/common/section/UiSection.vue'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TNodeHealth } from '@/application/services/clusterOverview/types/TNodeHealth'

@Component({
  components: { UiSection, UiStatusDot },
})
export default class OverviewNodeHealth extends VueBase {
  @Prop({ required: true })
  public readonly health: TNodeHealth

  @Prop({ required: false, default: '' })
  public readonly path?: string

  public get description(): string {
    return `${this.health.ready} of ${this.health.total} Ready`
  }
}
</script>
