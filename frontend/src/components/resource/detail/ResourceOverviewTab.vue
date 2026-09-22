<template>
  <div class="space-y-4">
    <resource-metrics-section v-if="hasMetrics" :object="state.object" :target="target" />

    <resource-section v-if="containers.length > 0" :hint="containerHint" title="Containers">
      <resource-container-list :containers="containers" />
    </resource-section>

    <resource-section v-if="taints.length > 0" :hint="taintHint" title="Taints">
      <resource-taint-list :taints="taints" />
    </resource-section>

    <resource-section v-if="conditions.length > 0" title="Conditions">
      <resource-condition-list :conditions="conditions" />
    </resource-section>

    <resource-related-skeleton v-if="relationsPending" />

    <template v-else>
      <resource-related-group
          v-for="group in state.relations"
          :key="group.title"
          :group="group"
          @open="$emit('open', $event)"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ResourceConditionList from '@/components/resource/detail/ResourceConditionList.vue'
import ResourceContainerList from '@/components/resource/detail/ResourceContainerList.vue'
import ResourceMetricsSection from '@/components/resource/detail/ResourceMetricsSection.vue'
import ResourceRelatedGroup from '@/components/resource/detail/ResourceRelatedGroup.vue'
import ResourceRelatedSkeleton from '@/components/resource/detail/ResourceRelatedSkeleton.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import ResourceTaintList from '@/components/resource/detail/ResourceTaintList.vue'
import { DetailConditions } from '@/components/resource/detail/DetailConditions'
import { DetailContainers } from '@/components/resource/detail/DetailContainers'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { DetailTaints } from '@/components/resource/detail/DetailTaints'
import type { TDetailCondition } from '@/components/resource/detail/types/TDetailCondition'
import type { TDetailContainer } from '@/components/resource/detail/types/TDetailContainer'
import type { TDetailTaint } from '@/components/resource/detail/types/TDetailTaint'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: {
    ResourceConditionList,
    ResourceContainerList,
    ResourceMetricsSection,
    ResourceRelatedGroup,
    ResourceRelatedSkeleton,
    ResourceSection,
    ResourceTaintList,
  },
  emits: ['open'],
})
export default class ResourceOverviewTab extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  public get hasMetrics(): boolean {
    return DetailTabs.hasMetrics(this.target.kind)
  }

  // A reload keeps the groups it already has on screen; only an empty panel gets the skeleton.
  public get relationsPending(): boolean {
    return this.state.relationsLoading && this.state.relations.length === 0
  }

  public get containers(): TDetailContainer[] {
    return DetailContainers.of(this.state.object)
  }

  public get conditions(): TDetailCondition[] {
    return DetailConditions.of(this.state.object)
  }

  public get taints(): TDetailTaint[] {
    return DetailTaints.of(this.state.object)
  }

  public get taintHint(): string {
    return `${this.taints.length} on this node`
  }

  public get containerHint(): string {
    const running = this.containers.filter(container => container.tone === 'ok').length

    return `${running}/${this.containers.length} healthy`
  }
}
</script>
