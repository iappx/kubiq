<template>
  <div class="space-y-4">
    <resource-section title="Details">
      <resource-fact-list :facts="facts" />
    </resource-section>

    <resource-section v-if="containers.length > 0" :hint="containerHint" title="Containers">
      <resource-container-list :containers="containers" />
    </resource-section>

    <resource-section v-if="conditions.length > 0" title="Conditions">
      <resource-condition-list :conditions="conditions" />
    </resource-section>

    <resource-related-group
        v-for="group in state.relations"
        :key="group.title"
        :group="group"
        @open="$emit('open', $event)"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ResourceConditionList from '@/components/resource/detail/ResourceConditionList.vue'
import ResourceContainerList from '@/components/resource/detail/ResourceContainerList.vue'
import ResourceFactList from '@/components/resource/detail/ResourceFactList.vue'
import ResourceRelatedGroup from '@/components/resource/detail/ResourceRelatedGroup.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { DetailConditions } from '@/components/resource/detail/DetailConditions'
import { DetailContainers } from '@/components/resource/detail/DetailContainers'
import { DetailFacts } from '@/components/resource/detail/DetailFacts'
import type { TDetailCondition } from '@/components/resource/detail/types/TDetailCondition'
import type { TDetailContainer } from '@/components/resource/detail/types/TDetailContainer'
import type { TDetailFact } from '@/components/resource/detail/types/TDetailFact'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: {
    ResourceConditionList,
    ResourceContainerList,
    ResourceFactList,
    ResourceRelatedGroup,
    ResourceSection,
  },
  emits: ['open'],
})
export default class ResourceOverviewTab extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  public get facts(): TDetailFact[] {
    return DetailFacts.of(this.state.object, this.kind)
  }

  public get containers(): TDetailContainer[] {
    return DetailContainers.of(this.state.object)
  }

  public get conditions(): TDetailCondition[] {
    return DetailConditions.of(this.state.object)
  }

  public get containerHint(): string {
    const running = this.containers.filter(container => container.tone === 'ok').length

    return `${running}/${this.containers.length} healthy`
  }
}
</script>
