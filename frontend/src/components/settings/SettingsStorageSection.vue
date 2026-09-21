<template>
  <ui-section
      description="Settings and the application journal live in your user profile, never next to the binary."
      title="Storage"
  >
    <template #actions>
      <button :disabled="!canOpenLogs" class="btn-secondary" type="button" @click="$emit('open-logs')">
        <folder-open :size="14" aria-hidden="true" />
        Open log folder
      </button>
    </template>

    <dl class="grid gap-3 sm:grid-cols-2">
      <div>
        <dt class="text-xs text-muted-foreground">Data folder</dt>
        <dd :title="storage.root" class="truncate text-sm text-foreground">{{ rootPath }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted-foreground">Log folder</dt>
        <dd :title="storage.logs" class="truncate text-sm text-foreground">{{ logsPath }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted-foreground">Storage format</dt>
        <dd class="text-sm text-foreground tabular">Version {{ storage.version }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted-foreground">Settings schema</dt>
        <dd class="text-sm text-foreground tabular">Version {{ schemaVersion }}</dd>
      </div>
    </dl>
  </ui-section>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { FolderOpen } from '@lucide/vue'
import UiSection from '@/components/common/section/UiSection.vue'
import type { TStorageInfo } from '@/domain/models/settings'

@Component({
  components: { FolderOpen, UiSection },
  emits: ['open-logs'],
})
export default class SettingsStorageSection extends VueBase {
  private static readonly unknownPath = 'Available once kubiq runs as a desktop application'

  @Prop({ required: true })
  public readonly storage: TStorageInfo

  @Prop({ required: true })
  public readonly schemaVersion: number

  public get rootPath(): string {
    return this.storage.root || SettingsStorageSection.unknownPath
  }

  public get logsPath(): string {
    return this.storage.logs || SettingsStorageSection.unknownPath
  }

  public get canOpenLogs(): boolean {
    return this.storage.logs !== ''
  }
}
</script>
