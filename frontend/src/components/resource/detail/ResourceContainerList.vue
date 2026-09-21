<template>
  <ul class="space-y-2">
    <li v-for="container in containers" :key="container.name" class="rounded-md border border-border px-3 py-2">
      <div class="flex items-baseline justify-between gap-2">
        <span class="min-w-0 truncate text-xs font-medium text-foreground">{{ container.name }}</span>
        <ui-status-badge :label="container.state" :tone="container.tone" />
      </div>

      <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{{ container.image }}</p>

      <p v-if="footnote(container)" class="mt-1 text-xs text-muted-foreground">{{ footnote(container) }}</p>
    </li>
  </ul>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import type { TDetailContainer } from '@/components/resource/detail/types/TDetailContainer'

@Component({
  components: { UiStatusBadge },
})
export default class ResourceContainerList extends VueBase {
  @Prop({ required: true })
  public readonly containers: TDetailContainer[]

  public footnote(container: TDetailContainer): string {
    const parts = [container.detail]
    if (container.restarts > 0) {
      parts.push(`${container.restarts} ${container.restarts === 1 ? 'restart' : 'restarts'}`)
    }

    return parts.filter(part => part !== '').join(' · ')
  }
}
</script>
