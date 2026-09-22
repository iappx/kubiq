<template>
  <div class="flex flex-1 min-w-0 min-h-0">
    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <ui-deferred-loader v-if="!helmStore.checked" :loading="true" class="flex-1">
        <template #loading>
          <ui-skeletons :columns="6" :count="8" :density="uiStore.density" type="table" />
        </template>
      </ui-deferred-loader>

      <helm-unavailable-notice
          v-else-if="!helmStore.isAvailable"
          :checking="helmStore.checking"
          :detail="helmStore.availability.detail"
          :reason="unavailableReason"
          @install="helmStore.openInstallGuide()"
          @retry="helmStore.retry()"
      />

      <template v-else>
        <div class="px-4 pt-3">
          <ui-tab-bar :active="tab" :tabs="tabs" class="mb-0" @change="switchTab($event)" />
        </div>

        <helm-releases-section
            v-if="tab === releasesKey"
            :busy="operationStore.isRunning"
            :density="uiStore.density"
            :width="uiStore.panelWidth"
            @install="startInstall(null)"
            @rollback="askRollback($event)"
            @uninstall="askUninstall($event)"
            @update:width="uiStore.setPanelWidth($event)"
            @upgrade="startUpgrade($event)"
        />

        <helm-repositories-section
            v-else-if="tab === repositoriesKey"
            :density="uiStore.density"
            @browse="browseRepository($event)"
        />

        <helm-charts-section
            v-else
            :density="uiStore.density"
            :width="uiStore.panelWidth"
            @install="startInstall($event)"
            @update:width="uiStore.setPanelWidth($event)"
        />
      </template>
    </div>

    <helm-install-panel
        :busy="operationStore.isRunning"
        :errors="installErrors"
        :initial-chart="installChart"
        :initial-namespace="installNamespace"
        :initial-values="installValues"
        :initial-version="installVersion"
        :namespaces="namespaces"
        :open="installOpen"
        :width="uiStore.panelWidth"
        @close="installOpen = false"
        @submit="install($event)"
        @update:width="uiStore.setPanelWidth($event)"
    />

    <helm-upgrade-panel
        :busy="operationStore.isRunning"
        :errors="upgradeErrors"
        :initial-chart="upgradeChart"
        :initial-values="upgradeValues"
        :open="upgradeOpen"
        :release="upgradeRow"
        :width="uiStore.panelWidth"
        @close="upgradeOpen = false"
        @submit="upgrade($event)"
        @update:width="uiStore.setPanelWidth($event)"
    />

    <helm-operation-panel
        :lines="operationLines"
        :operation="operationStore.active"
        :width="uiStore.panelWidth"
        @cancel="cancelOperation"
        @close="closeOperation"
        @update:width="uiStore.setPanelWidth($event)"
    />

    <confirm-dialog
        :description="uninstallDescription"
        :loading="operationStore.isRunning"
        :open="!!uninstallRow"
        confirm-label="Uninstall"
        title="Uninstall this release?"
        @cancel="uninstallRow = null"
        @confirm="uninstall"
    />

    <confirm-dialog
        :description="rollbackDescription"
        :loading="operationStore.isRunning"
        :open="!!rollbackRow"
        confirm-label="Roll back"
        title="Roll this release back?"
        @cancel="rollbackRow = null"
        @confirm="rollback"
    />
  </div>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import HelmChartsSection from '@/components/helm/HelmChartsSection.vue'
import HelmInstallPanel from '@/components/helm/HelmInstallPanel.vue'
import HelmOperationPanel from '@/components/helm/HelmOperationPanel.vue'
import HelmReleasesSection from '@/components/helm/HelmReleasesSection.vue'
import HelmRepositoriesSection from '@/components/helm/HelmRepositoriesSection.vue'
import HelmUnavailableNotice from '@/components/helm/HelmUnavailableNotice.vue'
import HelmUpgradePanel from '@/components/helm/HelmUpgradePanel.vue'
import type { THelmChartRow } from '@/components/helm/types/THelmChartRow'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import { HelmInstallValidator } from '@/application/validators/HelmInstallValidator'
import { HelmUpgradeValidator } from '@/application/validators/HelmUpgradeValidator'
import type { THelmInstallDraft } from '@/domain/entities/helm/types/THelmInstallDraft'
import type { THelmUpgradeDraft } from '@/domain/entities/helm/types/THelmUpgradeDraft'
import { HelmReleaseInstalledEvent } from '@/domain/events/helm/HelmReleaseInstalledEvent'
import { HelmReleaseRolledBackEvent } from '@/domain/events/helm/HelmReleaseRolledBackEvent'
import { HelmReleaseUninstalledEvent } from '@/domain/events/helm/HelmReleaseUninstalledEvent'
import { HelmReleaseUpgradedEvent } from '@/domain/events/helm/HelmReleaseUpgradedEvent'
import { HelmRepositoriesChangedEvent } from '@/domain/events/helm/HelmRepositoriesChangedEvent'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { RouteQueryState } from '@/lib/router/query/RouteQueryState'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import { HelmOperationStore } from '@/store/modules/helm/HelmOperationStore'
import { HelmRepositoryStore } from '@/store/modules/helm/HelmRepositoryStore'
import { HelmStore } from '@/store/modules/helm/HelmStore'

@Component({
  components: {
    ConfirmDialog,
    HelmChartsSection,
    HelmInstallPanel,
    HelmOperationPanel,
    HelmReleasesSection,
    HelmRepositoriesSection,
    HelmUnavailableNotice,
    HelmUpgradePanel,
    UiDeferredLoader,
    UiSkeletons,
    UiTabBar,
  },
})
export default class ClusterHelmPage extends VueBase {
  public static readonly releasesKey: string = 'releases'

  public static readonly repositoriesKey: string = 'repositories'

  public static readonly chartsKey: string = 'charts'

  public tab: string = ClusterHelmPage.releasesKey

  public installOpen = false

  public installChart = ''

  public installVersion = ''

  public installValues = ''

  public installNamespace = ''

  public installErrors: Record<string, string> = {}

  public upgradeOpen = false

  public upgradeRow: THelmReleaseRow | null = null

  public upgradeChart = ''

  public upgradeValues = ''

  public upgradeErrors: Record<string, string> = {}

  public uninstallRow: THelmReleaseRow | null = null

  public rollbackRow: THelmReleaseRow | null = null

  public rollbackRevision = 0

  private onReleaseChanged!: (event: { namespace: string, releaseName: string }) => void

  private onRepositoriesChanged!: () => void

  private queryState!: RouteQueryState

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(HelmStore) public readonly helmStore: HelmStore,
      @inject(HelmRepositoryStore) public readonly repositoryStore: HelmRepositoryStore,
      @inject(HelmOperationStore) public readonly operationStore: HelmOperationStore,
      @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
      @inject(ClusterConnectionStore) private readonly connectionStore: ClusterConnectionStore,
      @inject(HelmInstallValidator) private readonly installValidator: HelmInstallValidator,
      @inject(HelmUpgradeValidator) private readonly upgradeValidator: HelmUpgradeValidator,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public get releasesKey(): string {
    return ClusterHelmPage.releasesKey
  }

  public get repositoriesKey(): string {
    return ClusterHelmPage.repositoriesKey
  }

  public get tabs(): TTab[] {
    return [
      { key: ClusterHelmPage.releasesKey, label: 'Releases' },
      { key: ClusterHelmPage.repositoriesKey, label: 'Repositories' },
      { key: ClusterHelmPage.chartsKey, label: 'Charts' },
    ]
  }

  public get namespaces(): string[] {
    return this.namespaceStore.availableOf(this.clusterId)
  }

  public get scope(): string[] {
    return this.connectionStore.namespacesOf(this.clusterId)
  }

  public get unavailableReason(): string {
    return this.helmStore.availability.reason || 'Kubiq could not run helm on this machine'
  }

  public get operationLines(): readonly string[] {
    const active = this.operationStore.active

    return active && active.revision >= 0 ? this.operationStore.lines(active.key) : []
  }

  public get uninstallDescription(): string {
    const row = this.uninstallRow

    return row
        ? `Everything release "${row.name}" installed in ${row.namespace} is deleted from the cluster. This cannot be undone.`
        : ''
  }

  public get rollbackDescription(): string {
    const row = this.rollbackRow

    return row
        ? `Release "${row.name}" in ${row.namespace} is returned to revision ${this.rollbackRevision}. Objects added after that revision are deleted.`
        : ''
  }

  created(): void {
    this.onReleaseChanged = event => void this.helmStore.refreshAfterOperation({
      name: event.releaseName,
      namespace: event.namespace,
    })
    this.onRepositoriesChanged = () => void this.repositoryStore.load()

    this.eventBus.registerHandler(HelmReleaseInstalledEvent, this.onReleaseChanged)
    this.eventBus.registerHandler(HelmReleaseUpgradedEvent, this.onReleaseChanged)
    this.eventBus.registerHandler(HelmReleaseUninstalledEvent, this.onReleaseChanged)
    this.eventBus.registerHandler(HelmReleaseRolledBackEvent, this.onReleaseChanged)
    this.eventBus.registerHandler(HelmRepositoriesChangedEvent, this.onRepositoriesChanged)

    this.queryState = new RouteQueryState(this.$router, [{
      key: ClusterRoutes.tabKey,
      read: () => this.tab,
      write: tab => void this.switchTab(tab),
      defaultValue: ClusterHelmPage.releasesKey,
    }])
    this.queryState.start()
  }

  async mounted(): Promise<void> {
    await this.enter()
  }

  beforeUnmount(): void {
    this.queryState.stop()
    this.eventBus.unregisterHandler(HelmReleaseInstalledEvent, this.onReleaseChanged)
    this.eventBus.unregisterHandler(HelmReleaseUpgradedEvent, this.onReleaseChanged)
    this.eventBus.unregisterHandler(HelmReleaseUninstalledEvent, this.onReleaseChanged)
    this.eventBus.unregisterHandler(HelmReleaseRolledBackEvent, this.onReleaseChanged)
    this.eventBus.unregisterHandler(HelmRepositoriesChangedEvent, this.onRepositoriesChanged)
  }

  @Watch('clusterId')
  async clusterChanged(): Promise<void> {
    await this.enter()
  }

  @Watch('scope')
  async scopeChanged(): Promise<void> {
    await this.helmStore.setNamespaces(this.scope)
  }

  public async switchTab(tab: string): Promise<void> {
    this.tab = tab

    if (tab !== ClusterHelmPage.releasesKey) {
      await this.repositoryStore.enter(this.clusterId)
    }
    if (tab === ClusterHelmPage.chartsKey && !this.repositoryStore.searched) {
      await this.repositoryStore.search()
    }
  }

  public async browseRepository(name: string): Promise<void> {
    this.tab = ClusterHelmPage.chartsKey

    await this.repositoryStore.setRepoFilter(name)
  }

  public startInstall(chart: THelmChartRow | null): void {
    this.closePanels()
    this.installChart = chart?.ref ?? ''
    this.installVersion = chart?.version ?? ''
    this.installValues = chart && this.repositoryStore.chartDetail?.ref === chart.ref
        ? this.repositoryStore.chartDetail.values
        : ''
    this.installNamespace = this.scope.length === 1 ? this.scope[0] : ''
    this.installErrors = {}
    this.installOpen = true
  }

  public startUpgrade(row: THelmReleaseRow | null): void {
    if (!row) {
      return
    }

    this.upgradeRow = row
    this.upgradeChart = this.chartRefFor(row)
    this.upgradeValues = this.helmStore.detail?.name === row.name ? this.helmStore.detail.values : ''
    this.upgradeErrors = {}
    this.closePanels()
    this.upgradeOpen = true
  }

  public async install(draft: THelmInstallDraft): Promise<void> {
    const result = this.installValidator.validate(draft)
    this.installErrors = result.errors
    if (!result.valid) {
      return
    }

    this.installOpen = false
    await this.operationStore.install(this.clusterId, draft)
  }

  public async upgrade(draft: THelmUpgradeDraft): Promise<void> {
    const result = this.upgradeValidator.validate(draft)
    this.upgradeErrors = result.errors
    if (!result.valid) {
      return
    }

    this.upgradeOpen = false
    await this.operationStore.upgrade(this.clusterId, draft)
  }

  public askUninstall(row: THelmReleaseRow | null): void {
    this.uninstallRow = row
  }

  public askRollback(request: { row: THelmReleaseRow | null, revision: number }): void {
    this.rollbackRow = request.row
    this.rollbackRevision = request.revision
  }

  public async uninstall(): Promise<void> {
    const row = this.uninstallRow
    this.uninstallRow = null
    if (!row) {
      return
    }

    this.closePanels()
    await this.operationStore.uninstall(this.clusterId, { name: row.name, namespace: row.namespace }, false)
  }

  public async rollback(): Promise<void> {
    const row = this.rollbackRow
    const revision = this.rollbackRevision
    this.rollbackRow = null
    if (!row) {
      return
    }

    this.closePanels()
    await this.operationStore.rollback(this.clusterId, { name: row.name, namespace: row.namespace }, revision)
  }

  public async cancelOperation(): Promise<void> {
    const active = this.operationStore.active
    if (active) {
      await this.operationStore.cancel(active.key)
    }
  }

  public closeOperation(): void {
    const active = this.operationStore.active
    if (active) {
      this.operationStore.close(active.key)
    }
  }

  private async enter(): Promise<void> {
    await this.helmStore.enter(this.clusterId, this.scope)

    if (this.helmStore.isAvailable && this.tab !== ClusterHelmPage.releasesKey) {
      await this.repositoryStore.enter(this.clusterId)
    }
  }

  private closePanels(): void {
    this.helmStore.close()
    this.repositoryStore.closeChart()
    this.installOpen = false
    this.upgradeOpen = false
  }

  // helm keeps no record of the repository a release came from, so the field is a
  // best guess from the repositories on this machine and the operator can correct it.
  private chartRefFor(row: THelmReleaseRow): string {
    const match = this.repositoryStore.charts.find(chart => chart.chartName === row.chart)

    return match ? match.ref : row.chart
  }
}
</script>
