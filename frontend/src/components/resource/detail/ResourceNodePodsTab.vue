<template>
  <div class="space-y-4">
    <ui-error-state
        v-if="state.forbidden"
        :retryable="false"
        message="You cannot list pods in this cluster, so what runs on this node cannot be shown."
        title="Not permitted"
    />

    <ui-error-state
        v-else-if="state.error"
        :detail="state.errorDetail"
        :message="state.error"
        title="Could not read the pods on this node"
        @retry="reload"
    />

    <ui-deferred-loader v-else-if="!state.loaded" :loading="true">
      <template #loading>
        <ui-skeletons :count="4" type="rows" />
      </template>
    </ui-deferred-loader>

    <resource-section v-else :hint="hint" title="Pods on this node">
      <ul v-if="pods.length > 0" class="space-y-1.5">
        <resource-node-pod-row
            v-for="pod in pods"
            :key="pod.uid"
            :pod="pod"
            @open="openPod"
        />
      </ul>

      <p v-else class="text-xs text-muted-foreground">Nothing is scheduled on this node.</p>
    </resource-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import ResourceNodePodRow from '@/components/resource/detail/ResourceNodePodRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'
import { NodeDrainPolicy } from '@/domain/entities/cluster'
import type { PodEntity } from '@/domain/entities/workloads'
import { KubeKindLocator } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { NodeStore } from '@/store/modules/node/NodeStore'
import type { TNodePodsState } from '@/store/modules/node/types/TNodePodsState'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'

@Component({
  components: {
    ResourceNodePodRow,
    ResourceSection,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
  },
  emits: ['open'],
})
export default class ResourceNodePodsTab extends VueBase {
  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  constructor(
      @inject(NodeStore) public readonly nodeStore: NodeStore,
  ) {
    super()
  }

  public get state(): TNodePodsState {
    return this.nodeStore.podsOf(this.target.clusterId, this.target.name)
  }

  public get pods(): PodEntity[] {
    return this.state.pods
  }

  public get podsKind(): KubeResourceKind | null {
    return KubeKindLocator.find(this.target.served, 'v1', 'Pod') ?? null
  }

  public get hint(): string {
    const evictable = NodeDrainPolicy.evictable(this.pods).length

    return `${this.pods.length} running, ${evictable} would be evicted by a drain`
  }

  async created(): Promise<void> {
    await this.reload()
  }

  public async reload(): Promise<void> {
    const podsKind = this.podsKind
    if (!podsKind) {
      return
    }

    await this.nodeStore.loadPods({
      clusterId: this.target.clusterId,
      podsKind,
      nodeName: this.target.name,
    })
  }

  public openPod(pod: PodEntity): void {
    const related: TRelatedObject = {
      key: `pod/${pod.namespace}/${pod.name}`,
      kindName: 'Pod',
      name: pod.name,
      namespace: pod.namespace,
      kind: this.podsKind,
      detail: pod.readyText,
    }

    this.$emit('open', related)
  }
}
</script>
