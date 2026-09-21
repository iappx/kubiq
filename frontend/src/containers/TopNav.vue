<template>
  <header class="h-14 shrink-0 flex items-center gap-3 px-4 bg-card border-b border-border">
    <router-link :to="catalogPath" class="shrink-0" title="Cluster catalog">
      <app-logo size="sm" />
    </router-link>

    <template v-if="onCluster">
      <span aria-hidden="true" class="ui-topnav-divider" />

      <cluster-switcher
          :cluster-id="clusterId"
          :connections="connectionStore.connections"
          @catalog="goToCatalog"
          @switch="switchCluster"
      />

      <namespace-scope
          :available="namespaceStore.availableOf(clusterId)"
          :selected="connectionStore.namespacesOf(clusterId)"
          @update:selected="setNamespaces"
      />
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
import ClusterSwitcher from '@/components/clusterShell/ClusterSwitcher.vue'
import NamespaceScope from '@/components/clusterShell/NamespaceScope.vue'
import PaletteTrigger from '@/components/clusterShell/PaletteTrigger.vue'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { AppEnvironment } from '@/config/AppEnvironment'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

@Component({
  components: { AppLogo, AppThemeSwitcher, CircleHelp, ClusterSwitcher, NamespaceScope, PaletteTrigger, Settings },
})
export default class TopNav extends VueBase {
  constructor(
      @inject(ClusterConnectionStore) public readonly connectionStore: ClusterConnectionStore,
      @inject(ClusterNamespaceStore) public readonly namespaceStore: ClusterNamespaceStore,
  ) {
    super()
  }

  public get docsUrl(): string {
    return AppEnvironment.DocsUrl
  }

  public get catalogPath(): string {
    return ClusterRoutes.catalog
  }

  public get settingsPath(): string {
    return '/app/settings'
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

  public switchCluster(clusterId: string): void {
    this.connectionStore.activate(clusterId)
    void this.$router.push(ClusterRoutes.shell(clusterId))
  }

  public setNamespaces(namespaces: string[]): void {
    void this.connectionStore.setNamespaces(this.clusterId, namespaces)
  }
}
</script>
