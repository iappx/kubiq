<template>
  <resource-section :hint="hint" :title="title">
    <p v-if="isSecret" class="pb-2 text-xs text-muted-foreground">
      Values are hidden until you reveal one, and a revealed value is shown on screen only —
      kubiq never writes it to a log or a file.
    </p>

    <div v-if="entries.length > 0" class="flex items-center gap-2 pb-2">
      <ui-search-field v-model="query" :placeholder="filterPlaceholder" class="min-w-0 flex-1" />

      <button
          :aria-label="copyAllLabel"
          :disabled="copyCount === 0"
          :title="copyAllLabel"
          class="btn-secondary shrink-0"
          type="button"
          @click="copyAll"
      >
        <copy :size="14" aria-hidden="true" />
        Copy all
      </button>
    </div>

    <ul v-if="shown.length > 0" class="space-y-2">
      <resource-data-row
          v-for="entry in shown"
          :key="`${entry.field}/${entry.key}`"
          :entry="entry"
          :object="state.object"
          @copy="copyEntry"
      />
    </ul>

    <div v-else-if="entries.length > 0" class="flex items-baseline gap-2 text-xs text-muted-foreground">
      <span class="min-w-0 truncate">No keys match “{{ query }}”</span>
      <button class="shrink-0 font-medium text-primary hover:underline" type="button" @click="query = ''">
        Clear filter
      </button>
    </div>

    <p v-else class="text-xs text-muted-foreground">This object carries no keys.</p>
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { Copy } from '@lucide/vue'
import { inject } from 'tsyringe'
import ResourceDataRow from '@/components/resource/detail/ResourceDataRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'
import { KubeClusterCatalog } from '@/domain/models/kube'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { Copy, ResourceDataRow, ResourceSection, UiSearchField },
})
export default class ResourceDataSection extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  public query = ''

  constructor(
      @inject(ResourceObjectStore) private readonly objectStore: ResourceObjectStore,
  ) {
    super()
  }

  public get isSecret(): boolean {
    return KubeClusterCatalog.isSecret(this.target.kind)
  }

  public get entries(): TDetailDataEntry[] {
    return DetailDataEntries.of(this.state.object, this.target.kind)
  }

  public get shown(): TDetailDataEntry[] {
    return DetailDataEntries.filter(this.state.object, this.entries, this.query)
  }

  public get copyCount(): number {
    return this.entries.filter(entry => DetailDataEntries.isCopyable(this.state.object, entry)).length
  }

  public get title(): string {
    return this.isSecret ? 'Secret data' : 'Data'
  }

  public get hint(): string {
    return this.entries.length === 0 ? '' : `${this.shown.length} of ${this.entries.length} records`
  }

  public get filterPlaceholder(): string {
    return this.isSecret ? 'Filter by key' : 'Filter by key or value'
  }

  public get copyAllLabel(): string {
    return this.isSecret
      ? 'Copy every key as YAML, with the secret values decoded'
      : 'Copy every key as YAML'
  }

  public get targetKey(): string {
    return ResourceObjectStore.keyOf(this.target)
  }

  @Watch('targetKey')
  targetChanged(): void {
    this.query = ''
  }

  public async copyEntry(entry: TDetailDataEntry): Promise<void> {
    await this.objectStore.copyDataValue(this.target, DetailDataEntries.pairOf(this.state.object, entry))
  }

  public async copyAll(): Promise<void> {
    await this.objectStore.copyDataMap(this.target, DetailDataEntries.pairsOf(this.state.object, this.entries))
  }
}
</script>
