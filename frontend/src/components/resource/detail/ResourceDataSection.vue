<template>
  <resource-section :hint="hint" :title="title">
    <div v-if="isImmutable" class="flex items-center gap-2 pb-2">
      <span class="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <lock :size="12" aria-hidden="true" />
        Immutable
      </span>
      <span class="text-xs text-muted-foreground">
        Keys on an immutable object cannot be added, edited or deleted.
      </span>
    </div>

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

      <button
          v-if="canEdit"
          :disabled="state.applying"
          class="btn-secondary shrink-0"
          type="button"
          @click="openAdd"
      >
        <plus :size="14" aria-hidden="true" />
        Add key
      </button>
    </div>

    <ul v-if="shown.length > 0" class="space-y-2">
      <resource-data-row
          v-for="entry in shown"
          :key="`${entry.field}/${entry.key}`"
          :editable="canEdit"
          :entry="entry"
          :object="state.object"
          @copy="copyEntry"
          @delete="askDelete"
          @edit="openEdit"
      />
    </ul>

    <div v-else-if="entries.length > 0" class="flex items-baseline gap-2 text-xs text-muted-foreground">
      <span class="min-w-0 truncate">No keys match “{{ query }}”</span>
      <button class="shrink-0 font-medium text-primary hover:underline" type="button" @click="query = ''">
        Clear filter
      </button>
    </div>

    <div v-else class="flex items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground">This object carries no keys.</p>
      <button
          v-if="canEdit"
          :disabled="state.applying"
          class="btn-secondary shrink-0"
          type="button"
          @click="openAdd"
      >
        <plus :size="14" aria-hidden="true" />
        Add key
      </button>
    </div>

    <resource-data-edit-dialog
        :busy="state.applying"
        :existing-keys="existingKeys"
        :initial-key="editingKey"
        :initial-value="editingValue"
        :is-secret="isSecret"
        :open="editOpen"
        @cancel="closeEdit"
        @save="saveEdit"
    />

    <confirm-dialog
        :description="deleteDescription"
        :loading="state.applying"
        :open="deletingEntry !== null"
        :title="deleteTitle"
        confirm-label="Delete"
        variant="danger"
        @cancel="cancelDelete"
        @confirm="confirmDelete"
    />
  </resource-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { Copy, Lock, Plus } from '@lucide/vue'
import { inject } from 'tsyringe'
import { ResourceDataEditor } from '@/application/services/resourceData/models/ResourceDataEditor'
import type { TResourceDataEditDraft } from '@/application/services/resourceData/types/TResourceDataEditDraft'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import UiSearchField from '@/components/common/search/UiSearchField.vue'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import ResourceDataEditDialog from '@/components/resource/detail/ResourceDataEditDialog.vue'
import ResourceDataRow from '@/components/resource/detail/ResourceDataRow.vue'
import ResourceSection from '@/components/resource/detail/ResourceSection.vue'
import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'
import { KubeClusterCatalog } from '@/domain/models/kube'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { ConfirmDialog, Copy, Lock, Plus, ResourceDataEditDialog, ResourceDataRow, ResourceSection, UiSearchField },
})
export default class ResourceDataSection extends VueBase {
  @Prop({ required: true })
  public readonly state: TResourceObjectState

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  public query = ''

  public editOpen = false

  public editingKey = ''

  public editingValue = ''

  public deletingEntry: TDetailDataEntry | null = null

  constructor(
      @inject(ResourceObjectStore) private readonly objectStore: ResourceObjectStore,
  ) {
    super()
  }

  public get isSecret(): boolean {
    return KubeClusterCatalog.isSecret(this.target.kind)
  }

  public get isImmutable(): boolean {
    return ResourceDataEditor.isImmutable(this.state.object)
  }

  public get canEdit(): boolean {
    return (this.target.kind.canPatch || this.target.kind.canUpdate) && !this.isImmutable
  }

  public get entries(): TDetailDataEntry[] {
    return DetailDataEntries.of(this.state.object, this.target.kind)
  }

  public get existingKeys(): string[] {
    return this.entries.map(entry => entry.key)
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

  public get deleteTitle(): string {
    return this.deletingEntry ? `Delete key ${this.deletingEntry.key}` : 'Delete key'
  }

  public get deleteDescription(): string {
    if (!this.deletingEntry) {
      return ''
    }

    const scope = this.target.namespace ? ` in ${this.target.namespace}` : ''

    return `Remove key "${this.deletingEntry.key}" from ${this.target.kind.kind} ${this.target.name}${scope}? `
      + 'Workloads reading this key will no longer receive it.'
  }

  public get targetKey(): string {
    return ResourceObjectStore.keyOf(this.target)
  }

  @Watch('targetKey')
  targetChanged(): void {
    this.query = ''
    this.closeEdit()
    this.deletingEntry = null
  }

  public async copyEntry(entry: TDetailDataEntry): Promise<void> {
    await this.objectStore.copyDataValue(this.target, DetailDataEntries.pairOf(this.state.object, entry))
  }

  public async copyAll(): Promise<void> {
    await this.objectStore.copyDataMap(this.target, DetailDataEntries.pairsOf(this.state.object, this.entries))
  }

  public openAdd(): void {
    this.editingKey = ''
    this.editingValue = ''
    this.editOpen = true
  }

  public openEdit(entry: TDetailDataEntry): void {
    this.editingKey = entry.key
    this.editingValue = DetailDataEntries.valueOf(this.state.object, entry)
    this.editOpen = true
  }

  public closeEdit(): void {
    this.editOpen = false
    this.editingKey = ''
    this.editingValue = ''
  }

  public async saveEdit(draft: TResourceDataEditDraft): Promise<void> {
    const saved = await this.objectStore.saveDataEntry(this.target, draft)
    if (saved) {
      this.closeEdit()
    }
  }

  public askDelete(entry: TDetailDataEntry): void {
    this.deletingEntry = entry
  }

  public cancelDelete(): void {
    this.deletingEntry = null
  }

  public async confirmDelete(): Promise<void> {
    if (!this.deletingEntry) {
      return
    }

    const deleted = await this.objectStore.removeDataEntry(this.target, this.deletingEntry.key, this.deletingEntry.field)
    if (deleted) {
      this.deletingEntry = null
    }
  }
}
</script>
