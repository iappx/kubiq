<template>
  <header class="h-14 shrink-0 flex items-center gap-3 px-4 bg-card border-b border-border">
    <router-link :to="catalogPath" class="shrink-0" title="Cluster catalog">
      <app-logo size="sm" />
    </router-link>

    <template v-if="onCluster">
      <span aria-hidden="true" class="ui-topnav-divider" />

      <cluster-switcher
          :cluster-id="clusterId"
          :rows="clusterRows"
          @catalog="goToCatalog"
          @switch="switchCluster"
      />

      <namespace-scope
          :available="namespaceStore.availableOf(clusterId)"
          :forbidden="namespaceStore.isForbidden(clusterId)"
          :selected="connectionStore.namespacesOf(clusterId)"
          @update:selected="setNamespaces"
      />

      <cluster-health-pill :cluster-id="clusterId" @reconnect="reconnect" />
    </template>

    <div class="ml-auto flex items-center gap-2">
      <palette-trigger />

      <a
          v-if="docsUrl"
          :href="docsUrl"
          class="btn-icon"
          target="_blank"
          title="Documentation"
      >
        <circle-help :size="18" />
      </a>

      <router-link
          :to="settingsPath"
          aria-label="Settings"
          class="btn-icon"
          title="Settings"
      >
        <settings :size="18" />
      </router-link>

      <app-theme-switcher />
    </div>
  </header>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { CircleHelp, Settings } from '@lucide/vue'
import AppLogo from '@/components/app/AppLogo.vue'
import AppThemeSwitcher from '@/components/app/AppThemeSwitcher.vue'
import ClusterHealthPill from '@/components/clusterShell/ClusterHealthPill.vue'
import ClusterSwitcher from '@/components/clusterShell/ClusterSwitcher.vue'
import NamespaceScope from '@/components/clusterShell/NamespaceScope.vue'
import PaletteTrigger from '@/components/clusterShell/PaletteTrigger.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { ClusterRowSource } from '@/components/cluster/ClusterRowSource'
import { AppEnvironment } from '@/config/AppEnvironment'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'

@Component({
  components: {
    AppLogo,
    AppThemeSwitcher,
    CircleHelp,
    ClusterHealthPill,
    ClusterSwitcher,
    NamespaceScope,
    PaletteTrigger,
    Settings,
  },
})
export default class TopNav extends VueBase {
  constructor(
      @inject(ClusterCatalogStore) public readonly catalogStore: ClusterCatalogStore,
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterHealthStore) public readonly healthStore: ClusterHealthStore,
      @inject(ClusterNamespaceStore) public readonly namespaceStore: ClusterNamespaceStore,
  ) {
    super()
  }

  public get clusterRows(): TClusterRow[] {
    return ClusterRowSource.build(this.catalogStore, this.connectionStore, this.healthStore)
  }

  public get docsUrl(): string {
    return AppEnvironment.DocsUrl
  }

  public get catalogPath(): string {
    return ClusterRoutes.catalog
  }

  public get settingsPath(): string {
    return ClusterRoutes.settings
  }

  public get onCluster(): boolean {
    return ClusterRoutes.isCluster(this.$route.path) && this.clusterId !== ''
  }

  public get clusterId(): string {
    const clusterId = this.$route.params.clusterId

    return typeof clusterId === 'string' ? clusterId : ''
  }

  public goToCatalog(): void {
    void this.$router.push(ClusterRoutes.catalog)
  }

  // The shell connects whatever cluster its route names, so switching to an unconnected one is
  // still a plain navigation.
  public switchCluster(clusterId: string): void {
    if (clusterId === '' || clusterId === this.clusterId) {
      return
    }

    void this.$router.push(ClusterRoutes.shell(clusterId))
  }

  public setNamespaces(namespaces: string[]): void {
    void this.connectionStore.setNamespaces(this.clusterId, namespaces)
  }

  public reconnect(): void {
    void this.connectionStore.connect(this.clusterId)
  }
}
</script>
