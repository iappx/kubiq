<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <ui-error-state
          v-if="discoveryFailure"
          :message="discoveryFailure"
          class="flex-1"
          title="Could not read what this cluster serves"
          @retry="recheck"
      />

      <ui-deferred-loader v-else-if="discovering" :loading="true" class="flex-1">
        <template #loading>
          <ui-skeletons :columns="6" :count="8" :density="uiStore.density" type="table" />
        </template>
      </ui-deferred-loader>

      <argo-unavailable-notice
          v-else-if="!argoStore.isInstalled"
          :checking="rechecking"
          :cluster-id="clusterId"
          @retry="recheck"
      />

      <template v-else>
        <div class="px-4 pt-3">
          <ui-tab-bar :active="activeTab" :tabs="tabs" class="mb-0" @change="switchTab($event)" />
        </div>

        <argo-applications-section
            v-if="activeTab === applicationsKey"
            :density="uiStore.density"
            :width="uiStore.panelWidth"
            @remove="askRemove($event)"
            @sync="startSync($event)"
            @update:width="uiStore.setPanelWidth($event)"
        />

        <argo-projects-section
            v-else-if="activeTab === projectsKey"
            :density="uiStore.density"
            :width="uiStore.panelWidth"
            @update:width="uiStore.setPanelWidth($event)"
        />

        <argo-application-sets-section
            v-else
            :density="uiStore.density"
            :width="uiStore.panelWidth"
            @update:width="uiStore.setPanelWidth($event)"
        />
      </template>
    </div>

    <argo-sync-panel
        :application-name="syncRow?.name ?? ''"
        :busy="argoStore.isBusy"
        :errors="syncErrors"
        :initial-revision="syncRevision"
        :open="syncOpen"
        :target-revision="syncRow?.targetRevision ?? ''"
        :width="uiStore.panelWidth"
        @close="syncOpen = false"
        @submit="sync($event)"
        @update:width="uiStore.setPanelWidth($event)"
    />

    <argo-delete-dialog
        :busy="argoStore.isBusy"
        :cascade-by-default="removeCascades"
        :open="!!removeRow"
        :row="removeRow"
        @cancel="removeRow = null"
        @confirm="remove($event)"
    />
  </div>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import ArgoApplicationSetsSection from '@/components/argocd/ArgoApplicationSetsSection.vue'
import ArgoApplicationsSection from '@/components/argocd/ArgoApplicationsSection.vue'
import ArgoDeleteDialog from '@/components/argocd/ArgoDeleteDialog.vue'
import ArgoProjectsSection from '@/components/argocd/ArgoProjectsSection.vue'
import ArgoSyncPanel from '@/components/argocd/ArgoSyncPanel.vue'
import ArgoUnavailableNotice from '@/components/argocd/ArgoUnavailableNotice.vue'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ArgoSyncValidator } from '@/application/validators/ArgoSyncValidator'
import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'
import { ArgoCapabilities, ArgoFinalizers } from '@/domain/models/argocd'
import type { TArgoCapabilities } from '@/domain/models/argocd'
import { RouteQueryState } from '@/lib/router/query/RouteQueryState'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ArgoProjectStore } from '@/store/modules/argocd/ArgoProjectStore'
import { ArgoStore } from '@/store/modules/argocd/ArgoStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'

@Component({
  components: {
    ArgoApplicationSetsSection,
    ArgoApplicationsSection,
    ArgoDeleteDialog,
    ArgoProjectsSection,
    ArgoSyncPanel,
    ArgoUnavailableNotice,
    UiDeferredLoader,
    UiErrorState,
    UiSkeletons,
    UiTabBar,
  },
})
export default class ClusterArgoPage extends VueBase {
  public static readonly applicationsKey: string = 'applications'

  public static readonly projectsKey: string = 'projects'

  public static readonly applicationSetsKey: string = 'applicationsets'

  public tab: string = ClusterArgoPage.applicationsKey

  public syncOpen = false

  public syncRow: TArgoApplicationRow | null = null

  public syncRevision = ''

  public syncErrors: Record<string, string> = {}

  public removeRow: TArgoApplicationRow | null = null

  private queryState!: RouteQueryState

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ArgoStore) public readonly argoStore: ArgoStore,
      @inject(ArgoProjectStore) public readonly projectStore: ArgoProjectStore,
      @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ArgoSyncValidator) private readonly syncValidator: ArgoSyncValidator,
  ) {
    super()
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public get applicationsKey(): string {
    return ClusterArgoPage.applicationsKey
  }

  public get projectsKey(): string {
    return ClusterArgoPage.projectsKey
  }

  public get capabilities(): TArgoCapabilities {
    return ArgoCapabilities.of(this.discoveryStore.kindsOf(this.clusterId))
  }

  public get discoveryFailure(): string {
    return this.discoveryStore.failureOf(this.clusterId)
  }

  public get rechecking(): boolean {
    return this.discoveryStore.isLoading(this.clusterId)
  }

  // Only the first read: a recheck leaves the notice on screen with its button spinning,
  // because replacing what is already there with a skeleton reads as a regression.
  public get discovering(): boolean {
    return !this.discoveryStore.isDiscovered(this.clusterId) && this.discoveryFailure === ''
  }

  // The address may still name a tab this cluster does not serve — a bookmark taken against
  // an installation that had ApplicationSets, opened against one that does not.
  public get activeTab(): string {
    return this.tabs.some(tab => tab.key === this.tab) ? this.tab : ClusterArgoPage.applicationsKey
  }

  public get tabs(): TTab[] {
    const tabs: TTab[] = [{ key: ClusterArgoPage.applicationsKey, label: 'Applications' }]

    if (this.capabilities.appProjects) {
      tabs.push({ key: ClusterArgoPage.projectsKey, label: 'Projects' })
    }
    if (this.capabilities.applicationSets) {
      tabs.push({ key: ClusterArgoPage.applicationSetsKey, label: 'Application sets' })
    }

    return tabs
  }

  // Deleting an application that already carries the finalizer would cascade whatever the
  // dialog said, so the toggle opens on what the cluster would do right now.
  public get removeCascades(): boolean {
    const application = this.argoStore.applications
        .find(candidate => this.argoStore.keyOf(candidate) === this.removeRow?.key)

    return ArgoFinalizers.hasCascade(application?.metadata?.finalizers ?? [])
  }

  created(): void {
    this.queryState = new RouteQueryState(this.$router, [{
      key: ClusterRoutes.tabKey,
      read: () => this.activeTab,
      write: tab => void this.switchTab(tab),
      defaultValue: ClusterArgoPage.applicationsKey,
    }])
    this.queryState.start()
  }

  async mounted(): Promise<void> {
    await this.enter()
  }

  beforeUnmount(): void {
    this.queryState.stop()
  }

  @Watch('clusterId')
  async clusterChanged(): Promise<void> {
    await this.enter()
  }

  public async switchTab(tab: string): Promise<void> {
    this.tab = tab

    if (tab !== ClusterArgoPage.applicationsKey) {
      await this.projectStore.enter(this.clusterId, this.capabilities)
    }
  }

  public async recheck(): Promise<void> {
    await this.discoveryStore.reload(this.clusterId)
    await this.enter()
  }

  public startSync(request: { row: TArgoApplicationRow | null, revision: string }): void {
    if (!request.row) {
      return
    }

    // Two side panels at once leave the table nothing to live in on a laptop.
    this.argoStore.close()
    this.syncRow = request.row
    this.syncRevision = request.revision
    this.syncErrors = {}
    this.syncOpen = true
  }

  public async sync(draft: TArgoSyncDraft): Promise<void> {
    const row = this.syncRow
    if (!row) {
      return
    }

    const result = this.syncValidator.validate(draft)
    this.syncErrors = result.errors
    if (!result.valid) {
      return
    }

    const application = this.argoStore.applications
        .find(candidate => this.argoStore.keyOf(candidate) === row.key)
    if (!application) {
      return
    }

    this.syncOpen = false
    await this.argoStore.sync(application, draft)
  }

  public askRemove(row: TArgoApplicationRow | null): void {
    this.removeRow = row
  }

  public async remove(cascade: boolean): Promise<void> {
    const row = this.removeRow
    this.removeRow = null
    if (!row) {
      return
    }

    const application = this.argoStore.applications
        .find(candidate => this.argoStore.keyOf(candidate) === row.key)
    if (!application) {
      return
    }

    await this.argoStore.remove(application, cascade)
  }

  private async enter(): Promise<void> {
    await this.discoveryStore.loadOnce(this.clusterId)
    await this.argoStore.enter(this.clusterId, this.capabilities)

    if (this.argoStore.isInstalled && this.activeTab !== ClusterArgoPage.applicationsKey) {
      await this.projectStore.enter(this.clusterId, this.capabilities)
    }
  }
}
</script>
