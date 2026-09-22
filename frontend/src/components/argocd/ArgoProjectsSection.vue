<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <div class="ui-toolbar">
        <div class="flex items-baseline gap-2 min-w-0">
          <h2 class="text-sm font-semibold text-foreground truncate">Projects</h2>
          <span class="text-xs text-muted-foreground tabular shrink-0">{{ rows.length }}</span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <button
              :disabled="store.loading"
              aria-label="Reload the projects"
              class="btn-icon w-7 h-7"
              title="Reload the projects"
              type="button"
              @click="store.load()"
          >
            <refresh-cw :class="store.loading ? 'animate-spin' : ''" :size="14" />
          </button>
        </div>
      </div>

      <ui-error-state
          v-if="store.error"
          :detail="store.errorDetail"
          :message="store.error"
          title="Could not list the projects"
          @retry="store.load()"
      />

      <ui-deferred-loader v-else-if="showSkeleton" :loading="true">
        <template #loading>
          <ui-skeletons :columns="6" :count="8" :density="density" type="table" />
        </template>
      </ui-deferred-loader>

      <ui-data-table
          v-else
          :columns="columns"
          :cursor="cursor"
          :density="density"
          :hidden-keys="hiddenKeys"
          :refreshing="store.loading"
          :rows="rows"
          :sort="sort"
          class="flex-1"
          label="Argo CD projects"
          name-key="name"
          row-key="key"
          @open="store.openProject($event.key)"
          @update:cursor="cursor = $event"
          @update:sort="sort = $event"
      >
        <template #cell-createdAt="{ row }">
          <ui-age :value="row.createdAt" />
        </template>

        <template #empty>
          <empty-state
              :icon="emptyIcon"
              description="Argo CD always has a default project; this cluster reports none, which usually means you cannot list them."
              title="No Argo CD projects"
          />
        </template>
      </ui-data-table>
    </div>

    <argo-project-detail-panel
        :application-count="selectedCount"
        :project="store.selectedProject"
        :width="width"
        @close="store.closeProject()"
        @update:width="$emit('update:width', $event)"
    />
  </div>
</template>

<script lang="ts">
import type { Component as VueComponent } from 'vue'
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { FolderGit2, RefreshCw } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UiAge from '@/components/common/time/UiAge.vue'
import UiDataTable from '@/components/common/table/UiDataTable.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import ArgoProjectDetailPanel from '@/components/argocd/ArgoProjectDetailPanel.vue'
import { ArgoProjectColumns } from '@/components/argocd/ArgoProjectColumns'
import { ArgoProjectRowBuilder } from '@/components/argocd/ArgoProjectRowBuilder'
import type { TArgoProjectRow } from '@/components/argocd/types/TArgoProjectRow'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import { ArgoProjectStore } from '@/store/modules/argocd/ArgoProjectStore'
import { ArgoStore } from '@/store/modules/argocd/ArgoStore'

@Component({
  components: {
    ArgoProjectDetailPanel,
    EmptyState,
    RefreshCw,
    UiAge,
    UiDataTable,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
  },
  emits: ['update:width'],
})
export default class ArgoProjectsSection extends VueBase {
  @Prop({ required: true })
  public readonly density: TUiTableDensity

  @Prop({ required: true })
  public readonly width: number

  public hiddenKeys: string[] = ArgoProjectColumns.hiddenByDefault()

  public sort: TUiTableSort | null = null

  public cursor: string | null = null

  constructor(
      @inject(ArgoProjectStore) public readonly store: ArgoProjectStore,
      @inject(ArgoStore) private readonly applicationStore: ArgoStore,
  ) {
    super()
  }

  public get rows(): TArgoProjectRow[] {
    return ArgoProjectRowBuilder.build(this.store.projects, this.applicationStore.applications)
  }

  public get columns(): TUiTableColumn[] {
    return ArgoProjectColumns.all()
  }

  public get selectedCount(): number {
    return this.rows.find(row => row.key === this.store.selectedProjectKey)?.applicationCount ?? 0
  }

  public get showSkeleton(): boolean {
    return this.store.loading && this.store.projects.length === 0
  }

  public get emptyIcon(): VueComponent {
    return FolderGit2
  }
}
</script>
