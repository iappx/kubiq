<template>
  <li class="flex items-baseline gap-2 text-xs">
    <ui-status-dot :label="statusTitle" :tone="tone" class="translate-y-px shrink-0" />

    <button class="min-w-0 flex-1 truncate text-left text-foreground hover:underline" type="button" @click="open">
      {{ pod.name }}
    </button>

    <span class="w-32 shrink-0 truncate text-muted-foreground" :title="pod.namespace">{{ pod.namespace }}</span>
    <span class="w-12 shrink-0 text-right tabular text-muted-foreground">{{ pod.readyText }}</span>
    <span class="w-20 shrink-0 truncate text-muted-foreground" :title="verdict">{{ verdict }}</span>
  </li>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import UiStatusDot from '@/components/common/status/UiStatusDot.vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { NodeDrainPolicy } from '@/domain/entities/cluster'
import { KubeObjectStateCatalog } from '@/domain/entities/kube'
import type { PodEntity } from '@/domain/entities/workloads'

@Component({
  components: { UiStatusDot },
  emits: ['open'],
})
export default class ResourceNodePodRow extends VueBase {
  @Prop({ required: true })
  public readonly pod: PodEntity

  public get tone(): TUiTone {
    return this.pod.state
  }

  public get statusTitle(): string {
    return KubeObjectStateCatalog.title(this.pod.state)
  }

  public get verdict(): string {
    return NodeDrainPolicy.verdictFor(this.pod).evict ? 'Evictable' : 'Stays'
  }

  public open(): void {
    this.$emit('open', this.pod)
  }
}
</script>
