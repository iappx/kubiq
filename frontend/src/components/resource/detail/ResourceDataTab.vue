<template>
  <div class="space-y-4">
    <resource-section :hint="hint" :title="title">
      <p v-if="isSecret" class="pb-2 text-xs text-muted-foreground">
        Values are hidden until you reveal one, and a revealed value is shown on screen only —
        kubiq never writes it to a log or a file.
      </p>

      <ul v-if="entries.length > 0" class="space-y-2">
        <resource-data-row
            v-for="entry in entries"
            :key="`${entry.field}/${entry.key}`"
            :entry="entry"
            :object="state.object"
        />
      </ul>

      <p v-else class="text-xs text-muted-foreground">This object carries no keys.</p>
    </resource-section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import ResourceDataRow from '@/components/resource/detail/ResourceDataRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'
import { KubeClusterCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { ResourceDataRow, ResourceSection },
})
export default class ResourceDataTab extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  public get entries(): TDetailDataEntry[] {
    return DetailDataEntries.of(this.state.object, this.kind)
  }

  public get isSecret(): boolean {
    return this.kind !== null && KubeClusterCatalog.isSecret(this.kind)
  }

  public get title(): string {
    return this.isSecret ? 'Secret data' : 'Data'
  }

  public get hint(): string {
    return this.entries.length === 0 ? '' : `${this.entries.length} keys`
  }
}
</script>
