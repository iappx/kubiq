<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="mx-auto flex max-w-3xl flex-col gap-4 pb-4">
      <header>
        <h2 class="text-base font-semibold text-foreground">Settings</h2>
        <p class="text-sm text-muted-foreground">
          Everything on this page is stored in your user profile and applies to every cluster.
        </p>
      </header>

      <ui-error-state
          v-if="settingsStore.loadError"
          :detail="settingsStore.loadErrorDetail"
          :message="settingsStore.loadError"
          title="Could not read the settings"
          @retry="settingsStore.load()"
      />

      <settings-appearance-section
          :density="uiStore.density"
          :panel-width="uiStore.panelWidth"
          :theme="themeStore.appTheme"
          @update:density="setDensity"
          @update:panel-width="uiStore.setPanelWidth($event)"
          @update:theme="setTheme"
      />

      <settings-kubeconfig-section
          :sources="catalogStore.sources"
          @add="addOpen = true"
          @remove="askRemoveSource"
      />

      <settings-tools-section
          :helm-path="settingsStore.settings.helmPath"
          :kubectl-path="settingsStore.settings.kubectlPath"
          @update:helm-path="settingsStore.setHelmPath($event)"
          @update:kubectl-path="settingsStore.setKubectlPath($event)"
      />

      <settings-node-shell-section
          :node-shell-image="settingsStore.settings.nodeShellImage"
          @update:node-shell-image="settingsStore.setNodeShellImage($event)"
      />

      <settings-prometheus-section
          :busy="settingsStore.saving"
          :clusters="clusterIds"
          :entries="settingsStore.clusters"
          @remove="settingsStore.removeCluster($event)"
          @save="settingsStore.saveCluster($event)"
      />

      <settings-storage-section
          :schema-version="settingsStore.schemaVersion"
          :storage="settingsStore.storage"
          @open-logs="settingsStore.openLogFolder()"
      />
    </div>

    <add-kubeconfig-modal :busy="addBusy" :open="addOpen" @close="addOpen = false" @submit="addSource" />

    <delete-cluster-dialog
        :busy="deleteBusy"
        :open="!!pendingDelete"
        :target="pendingDelete"
        @cancel="pendingDelete = null"
        @confirm="confirmDelete"
    />
  </div>
</template>

<script lang="ts">
import { Component, VueBase } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import AddKubeconfigModal from '@/components/cluster/AddKubeconfigModal.vue'
import DeleteClusterDialog from '@/components/cluster/DeleteClusterDialog.vue'
import SettingsAppearanceSection from '@/components/settings/SettingsAppearanceSection.vue'
import SettingsKubeconfigSection from '@/components/settings/SettingsKubeconfigSection.vue'
import SettingsNodeShellSection from '@/components/settings/SettingsNodeShellSection.vue'
import SettingsPrometheusSection from '@/components/settings/SettingsPrometheusSection.vue'
import SettingsStorageSection from '@/components/settings/SettingsStorageSection.vue'
import SettingsToolsSection from '@/components/settings/SettingsToolsSection.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import { AppTheme } from '@/domain/models/theme'
import type { TKubeconfigSourceMode } from '@/domain/entities/catalog/types/TKubeconfigSourceMode'
import type { TAppDensity } from '@/domain/models/ui'
import type { TKubeconfigDeletion } from '@/store/modules/clusterCatalog/types/TKubeconfigDeletion'
import { AppSettingsStore } from '@/store/modules/settings/AppSettingsStore'
import { AppThemeStore } from '@/store/modules/appTheme/AppThemeStore'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'

@Component({
  components: {
    AddKubeconfigModal,
    DeleteClusterDialog,
    SettingsAppearanceSection,
    SettingsKubeconfigSection,
    SettingsNodeShellSection,
    SettingsPrometheusSection,
    SettingsStorageSection,
    SettingsToolsSection,
    UiErrorState,
  },
})
export default class SettingsPage extends VueBase {
  public addOpen = false

  public addBusy = false

  public pendingDelete: TKubeconfigDeletion | null = null

  public deleteBusy = false

  constructor(
      @inject(AppSettingsStore) public readonly settingsStore: AppSettingsStore,
      @inject(AppThemeStore) public readonly themeStore: AppThemeStore,
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ClusterCatalogStore) public readonly catalogStore: ClusterCatalogStore,
  ) {
    super()
  }

  public get clusterIds(): string[] {
    return this.catalogStore.items.map(context => context.name)
  }

  async created(): Promise<void> {
    await Promise.all([
      this.settingsStore.loadOnce(),
      this.catalogStore.loadOnce(),
    ])
  }

  public setTheme(theme: string): void {
    this.themeStore.setTheme(theme === AppTheme.Dark ? AppTheme.Dark : AppTheme.Light)
  }

  public setDensity(density: string): void {
    const next: TAppDensity = density === 'comfortable' ? 'comfortable' : 'compact'
    this.uiStore.setDensity(next)
  }

  public async addSource(path: string, origin: TKubeconfigSourceMode): Promise<void> {
    this.addBusy = true
    try {
      if (await this.catalogStore.addSource(path, origin)) {
        this.addOpen = false
      }
    } finally {
      this.addBusy = false
    }
  }

  public askRemoveSource(path: string): void {
    this.pendingDelete = this.catalogStore.deletionOf(path)
  }

  public async confirmDelete(): Promise<void> {
    const target = this.pendingDelete
    if (!target || this.deleteBusy) {
      return
    }

    this.deleteBusy = true
    try {
      await this.catalogStore.removeSource(target.filePath)
    } finally {
      this.deleteBusy = false
      this.pendingDelete = null
    }
  }
}
</script>
