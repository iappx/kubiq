<template>
  <resource-section :title="group.title">
    <ul class="space-y-1">
      <resource-related-row
          v-for="object in group.objects"
          :key="object.key"
          :object="object"
          @open="$emit('open', $event)"
      />
    </ul>
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ResourceRelatedRow from '@/components/resource/detail/ResourceRelatedRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import type { TRelatedGroup } from '@/application/services/resourceDetail/types/TRelatedGroup'

@Component({
  components: { ResourceRelatedRow, ResourceSection },
  emits: ['open'],
})
export default class ResourceRelatedGroup extends VueBase {
  @Prop({ required: true })
  public readonly group: TRelatedGroup
}
</script>
