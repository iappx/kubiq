<template>
  <app-frame>
    <sidebar
        :active-slug="activeSlug"
        :cluster-id="clusterId"
        :failure="discoveryStore.failureOf(clusterId)"
        :loading="discoveryStore.isLoading(clusterId)"
        :sections="sections"
    />

    <div class="flex flex-1 min-w-0 min-h-0 flex-col">
      <div class="flex flex-1 min-w-0 min-h-0">
        <router-view v-if="hasContent" />

        <ui-error-state
            v-else-if="discoveryStore.failureOf(clusterId)"
            :message="discoveryStore.failureOf(clusterId)"
            class="flex-1"
            title="Could not read what this cluster serves"
            @retry="discoveryStore.reload(clusterId)"
        />

        <ui-deferred-loader v-else :loading="true" class="flex-1">
          <template #loading>
            <ui-skeletons :columns="6" :count="12" :density="uiStore.density" type="table" />
          </template>
        </ui-deferred-loader>
      </div>

      <ui-dock
          :active="dockStore.activeKey"
          :collapsed="dockCollapsed"
          :height="uiStore.dockHeight"
          :tabs="dockStore.tabs"
          @close-tab="closeTab($event)"
          @update:active="dockStore.activate($event)"
          @update:collapsed="uiStore.setDockCollapsed($event)"
          @update:height="uiStore.setDockHeight($event)"
      >
        <template #actions>
          <terminal-launcher :cluster-id="clusterId" />
        </template>

        <pod-logs-panel v-if="isLogTab" :key="dockStore.activeKey" :session-key="dockStore.activeKey" />
        <terminal-panel v-else-if="isTerminalTab" :key="dockStore.activeKey" :session-key="dockStore.activeKey" />
        <port-forward-panel v-else-if="isForwardTab" :key="dockStore.activeKey" :cluster-id="clusterId" />
      </ui-dock>
    </div>
  </app-frame>
</template>

<script lang="ts">
import { Component, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import AppFrame from '@/containers/AppFrame.vue'
import Sidebar from '@/containers/Sidebar.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiDock from '@/components/common/panel/UiDock.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import PodLogsPanel from '@/components/logs/PodLogsPanel.vue'
import PortForwardPanel from '@/components/terminal/PortForwardPanel.vue'
import TerminalLauncher from '@/components/terminal/TerminalLauncher.vue'
import TerminalPanel from '@/components/terminal/TerminalPanel.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ClusterSectionBuilder } from '@/components/clusterShell/ClusterSectionBuilder'
import { ShellKeymap } from '@/components/clusterShell/ShellKeymap'
import { UiKeyboard } from '@/components/common/UiKeyboard'
import type { TClusterSection } from '@/components/clusterShell/types/TClusterSection'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { PodLogKey } from '@/domain/models/kube'
import { PortForwardKey, TerminalKey } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import { DockStore } from '@/store/modules/dock/DockStore'

@Component({
  components: {
    AppFrame,
    PodLogsPanel,
    PortForwardPanel,
    Sidebar,
    TerminalLauncher,
    TerminalPanel,
    UiDeferredLoader,
    UiDock,
    UiErrorState,
    UiSkeletons,
  },
})
export default class ClusterShellPage extends VueBase {
  private onEscape!: (event: KeyboardEvent) => void

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterDiscoveryStore) public readonly discoveryStore: ClusterDiscoveryStore,
      @inject(ClusterNamespaceStore) public readonly namespaceStore: ClusterNamespaceStore,
      @inject(DockStore) public readonly dockStore: DockStore,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get isLogTab(): boolean {
    return PodLogKey.isLog(this.dockStore.activeKey)
  }

  public get isTerminalTab(): boolean {
    return TerminalKey.isTerminal(this.dockStore.activeKey)
  }

  public get isForwardTab(): boolean {
    return PortForwardKey.isPortForward(this.dockStore.activeKey)
  }

  // The dock strip is always mounted because it carries the terminal launcher.
  public get dockCollapsed(): boolean {
    return this.uiStore.dockCollapsed || !this.dockStore.hasTabs
  }

  public closeTab(key: string): void {
    this.dockStore.close(key)
    this.eventBus.emitEvent(new DockTabClosedEvent(key))
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public get activeSlug(): string {
    const slug = this.$route.params.resource

    return typeof slug === 'string' ? slug : ''
  }

  // The overview is a child route too, so the :resource parameter alone cannot tell whether content is mounted.
  public get hasContent(): boolean {
    return this.$route.matched.length > 1
  }

  public get sections(): TClusterSection[] {
    return ClusterSectionBuilder.build(this.discoveryStore.kindsOf(this.clusterId))
  }

  created(): void {
    // Capture phase on purpose: Escape must reach the panel and the dock before UiDataTable claims it for the row cursor.
    this.onEscape = (event) => {
      if (ShellKeymap.command(event, UiKeyboard.isTyping(event.target)) !== 'escape') {
        return
      }
      if (!this.handleEscape()) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('keydown', this.onEscape, true)
  }

  async mounted(): Promise<void> {
    await this.enterCluster()
  }

  beforeUnmount(): void {
    document.removeEventListener('keydown', this.onEscape, true)
    this.uiStore.closeDetail()
  }

  @Watch('clusterId')
  async clusterChanged(): Promise<void> {
    this.uiStore.closeDetail()
    await this.enterCluster()
  }

  private handleEscape(): boolean {
    const target = ShellKeymap.escapeTarget({
      panelOpen: this.uiStore.detailOpen,
      dockOpen: this.dockStore.hasTabs && !this.uiStore.dockCollapsed,
    })

    if (target === 'panel') {
      this.uiStore.closeDetail()
      return true
    }
    if (target === 'dock') {
      this.uiStore.setDockCollapsed(true)
      return true
    }

    return false
  }

  private async enterCluster(): Promise<void> {
    if (!this.connectionStore.isConnected(this.clusterId)) {
      await this.$router.replace(ClusterRoutes.catalog)
      return
    }

    this.connectionStore.activate(this.clusterId)
    this.uiStore.setLastClusterId(this.clusterId)

    await Promise.all([
      this.discoveryStore.loadOnce(this.clusterId),
      this.namespaceStore.loadFor(this.clusterId),
    ])

    this.openDefaultPage()
  }

  private openDefaultPage(): void {
    if (this.hasContent) {
      return
    }

    void this.$router.replace(ClusterRoutes.overview(this.clusterId))
  }
}
</script>
