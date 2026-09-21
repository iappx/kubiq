<template>
  <div class="space-y-4">
    <resource-section :hint="countOf(labels)" title="Labels">
      <resource-key-value-list :pairs="labels" empty-label="This object carries no labels" />
    </resource-section>

    <resource-section :hint="countOf(annotations)" title="Annotations">
      <resource-key-value-list :pairs="annotations" empty-label="This object carries no annotations" />
    </resource-section>

    <resource-section v-if="finalizers.length > 0" title="Finalizers">
      <ul class="space-y-1">
        <li v-for="finalizer in finalizers" :key="finalizer" class="break-all text-xs text-muted-foreground">
          {{ finalizer }}
        </li>
      </ul>
    </resource-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ResourceKeyValueList from '@/components/resource/detail/ResourceKeyValueList.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { DetailFacts } from '@/components/resource/detail/DetailFacts'
import { KubeManifest } from '@/domain/models/kube'

@Component({
  components: { ResourceKeyValueList, ResourceSection },
})
export default class ResourceMetadataTab extends VueBase {
  @Prop({ required: true })
  public readonly object: Record<string, unknown>

  public get labels(): Record<string, string> {
    return DetailFacts.labelsOf(this.object)
  }

  public get annotations(): Record<string, string> {
    return DetailFacts.annotationsOf(this.object)
  }

  public get finalizers(): string[] {
    const finalizers = KubeManifest.metadataOf(this.object).finalizers

    return Array.isArray(finalizers) ? finalizers.filter((item): item is string => typeof item === 'string') : []
  }

  public countOf(pairs: Record<string, string>): string {
    const count = Object.keys(pairs).length

    return count === 0 ? '' : String(count)
  }
}
</script>
