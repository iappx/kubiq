<template>
  <span :title="summary" class="inline-flex items-center gap-1">
    <template v-if="initContainers.length > 0">
      <ui-status-dot
          v-for="container in initContainers"
          :key="`init/${container.name}`"
          :size="7"
          :tone="container.state"
      />
      <span aria-hidden="true" class="w-px h-3 bg-border"></span>
    </template>

    <ui-status-dot
        v-for="container in mainContainers"
        :key="container.name"
        :size="10"
        :tone="container.state"
    />

    <span class="sr-only">{{ summary }}</span>
  </span>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TPodContainerHealth } from '@/domain/entities/workloads'

@Component({
  components: { UiStatusDot },
})
export default class PodContainersCell extends VueBase {
  @Prop({ required: false, default: () => [] })
  public readonly containers?: TPodContainerHealth[]

  public get all(): TPodContainerHealth[] {
    return Array.isArray(this.containers) ? this.containers : []
  }

  public get initContainers(): TPodContainerHealth[] {
    return this.all.filter(container => container.isInit)
  }

  public get mainContainers(): TPodContainerHealth[] {
    return this.all.filter(container => !container.isInit)
  }

  public get summary(): string {
    if (this.all.length === 0) {
      return 'No containers reported'
    }

    return this.all.map(container => this.describe(container)).join(', ')
  }

  private describe(container: TPodContainerHealth): string {
    const name = container.isInit ? `${container.name} (init)` : container.name

    return `${name}: ${container.statusTitle}`
  }
}
</script>
