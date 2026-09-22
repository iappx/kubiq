<template>
  <div class="space-y-4">
    <resource-section title="Details">
      <resource-fact-list :facts="facts" />
    </resource-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ResourceFactList from '@/components/resource/detail/ResourceFactList.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { DetailFacts } from '@/components/resource/detail/DetailFacts'
import type { TDetailFact } from '@/components/resource/detail/types/TDetailFact'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { ResourceFactList, ResourceSection },
})
export default class ResourceDetailsTab extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  public get facts(): TDetailFact[] {
    return DetailFacts.of(this.state.object, this.kind)
  }
}
</script>
