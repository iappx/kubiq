<template>
  <resource-section :hint="hint" :title="group.title">
    <ul class="space-y-1">
      <resource-related-row
          v-for="object in visibleObjects"
          :key="object.key"
          :object="object"
          @open="$emit('open', $event)"
      />
    </ul>

    <button
        v-if="hiddenCount > 0"
        :aria-label="`Show ${hiddenCount} more in ${group.title}`"
        class="text-xs font-medium text-primary hover:underline"
        type="button"
        @click="expanded = true"
    >
      +{{ hiddenCount }} more
    </button>
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import ResourceRelatedRow from '@/components/resource/detail/ResourceRelatedRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import type { TRelatedGroup } from '@/application/services/resourceDetail/types/TRelatedGroup'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'

@Component({
  components: { ResourceRelatedRow, ResourceSection },
  emits: ['open'],
})
export default class ResourceRelatedGroup extends VueBase {
  public static readonly previewCount: number = 5

  @Prop({ required: true })
  public readonly group: TRelatedGroup

  public expanded = false

  public get visibleObjects(): TRelatedObject[] {
    return this.expanded ? this.group.objects : this.group.objects.slice(0, ResourceRelatedGroup.previewCount)
  }

  public get hiddenCount(): number {
    return this.group.objects.length - this.visibleObjects.length
  }

  public get hint(): string {
    return this.group.objects.length > 1 ? String(this.group.objects.length) : ''
  }

  @Watch('group')
  groupChanged(): void {
    this.expanded = false
  }
}
</script>
