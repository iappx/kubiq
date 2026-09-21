<template>
  <div class="flex flex-1 min-w-0 min-h-0 flex-col">
    <div class="ui-toolbar">
      <div class="flex items-baseline gap-2 min-w-0">
        <h2 class="text-sm font-semibold text-foreground truncate">Repositories</h2>
        <span class="text-xs text-muted-foreground tabular shrink-0">{{ store.repositories.length }}</span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
            :disabled="store.busy || store.loading"
            aria-label="Update the repository indexes"
            class="btn-secondary disabled:opacity-50"
            title="Update the repository indexes"
            type="button"
            @click="store.update()"
        >
          <refresh-cw :class="store.busy ? 'animate-spin' : ''" :size="14" />
          Update
        </button>

        <button class="btn-primary" type="button" @click="addOpen = true">
          <plus :size="14" />
          Add repository
        </button>
      </div>
    </div>

    <ui-error-state
        v-if="store.error"
        :detail="store.errorDetail"
        :message="store.error"
        title="Could not read the repositories"
        @retry="store.load()"
    />

    <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
      <template #loading>
        <ui-skeletons :columns="2" :count="6" :density="density" type="table" />
      </template>
    </ui-deferred-loader>

    <ui-data-table
        v-else
        :actions="actions"
        :columns="columns"
        :density="density"
        :label="'Chart repositories'"
        :refreshing="store.loading || store.busy"
        :rows="rows"
        class="flex-1"
        name-key="name"
        row-key="name"
        @action="onAction"
    >
      <template #empty>
        <empty-state
            :icon="emptyIcon"
            :on-action="openAdd"
            action-label="Add repository"
            description="A chart repository is where helm looks for charts. Add one to search and install charts."
            title="No chart repositories"
        />
      </template>
    </ui-data-table>

    <add-helm-repository-modal
        :busy="store.busy"
        :open="addOpen"
        @close="addOpen = false"
        @submit="add($event)"
    />

    <confirm-dialog
        :description="removeDescription"
        :loading="store.busy"
        :open="!!pendingRemoval"
        confirm-label="Remove"
        title="Remove this repository?"
        @cancel="pendingRemoval = ''"
        @confirm="confirmRemoval"
    />
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { Library, Plus, RefreshCw, Trash2 } from '@lucide/vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import AddHelmRepositoryModal from '@/components/helm/AddHelmRepositoryModal.vue'
import type { THelmRepositoryDraft } from '@/domain/entities/helm/types/THelmRepositoryDraft'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import { HelmRepositoryStore } from '@/store/modules/helm/HelmRepositoryStore'

@Component({
  components: {
    AddHelmRepositoryModal,
    ConfirmDialog,
    EmptyState,
    Plus,
    RefreshCw,
    UiDataTable,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
  },
})
export default class HelmRepositoriesSection extends VueBase {
  public static readonly removeAction: string = 'remove'

  @Prop({ required: true })
  public readonly density: TUiTableDensity

  public addOpen = false

  public pendingRemoval = ''

  constructor(
      @inject(HelmRepositoryStore) public readonly store: HelmRepositoryStore,
  ) {
    super()
  }

  public get rows(): THelmRepositoryDraft[] {
    return this.store.repositories.map(repository => ({ name: repository.name, url: repository.url }))
  }

  public get columns(): TUiTableColumn[] {
    return [
      { key: 'name', title: 'Name', locked: true },
      { key: 'url', title: 'Address' },
    ]
  }

  public get actions(): TUiMenuItem[] {
    return [{ key: HelmRepositoriesSection.removeAction, label: 'Remove…', icon: Trash2, danger: true }]
  }

  public get emptyIcon(): VueComponent {
    return Library
  }

  public get showSkeleton(): boolean {
    return this.store.loading && this.store.repositories.length === 0
  }

  public get removeDescription(): string {
    return `"${this.pendingRemoval}" is removed from the Helm configuration of this machine. Charts already installed from it keep running.`
  }

  public openAdd(): void {
    this.addOpen = true
  }

  public async add(draft: THelmRepositoryDraft): Promise<void> {
    await this.store.add(draft)
    this.addOpen = false
  }

  public onAction(event: { action: string, row: { name: string } }): void {
    if (event.action === HelmRepositoriesSection.removeAction) {
      this.pendingRemoval = event.row.name
    }
  }

  public async confirmRemoval(): Promise<void> {
    const name = this.pendingRemoval
    this.pendingRemoval = ''
    await this.store.remove(name)
  }
}
</script>
