<template>
  <ui-side-panel
      :label="panelLabel"
      :open="!!row"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>{{ row?.name }}</template>
    <template #subtitle>{{ subtitle }}</template>

    <template #actions>
      <button
          :aria-label="`Upgrade ${row?.name}`"
          :disabled="busy"
          class="btn-icon w-7 h-7 disabled:opacity-50"
          title="Upgrade"
          type="button"
          @click="$emit('upgrade')"
      >
        <refresh-cw :size="14" />
      </button>

      <button
          :aria-label="`Uninstall ${row?.name}`"
          :disabled="busy"
          class="btn-icon w-7 h-7 text-destructive disabled:opacity-50"
          title="Uninstall"
          type="button"
          @click="$emit('uninstall')"
      >
        <trash2 :size="14" />
      </button>
    </template>

    <!-- h-full, not auto: the values and manifest tabs measure the box monaco is mounted into. -->
    <div v-if="row" class="flex h-full min-h-0 flex-col gap-3">
      <div class="shrink-0 space-y-2">
        <ui-status-badge :label="row.statusText" :tone="tone" />

        <ui-tab-bar :active="activeTab" :tabs="tabs" class="mb-0" @change="$emit('update:active-tab', $event)" />
      </div>

      <slot />
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { RefreshCw, Trash2 } from '@lucide/vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import { HelmDetailTabs } from '@/components/helm/detail/HelmDetailTabs'
import { HelmToneMap } from '@/components/helm/HelmToneMap'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { RefreshCw, Trash2, UiSidePanel, UiStatusBadge, UiTabBar },
  emits: ['close', 'upgrade', 'uninstall', 'update:width', 'update:active-tab'],
})
export default class HelmReleaseDetailPanel extends VueBase {
  @Prop({ required: false, default: null })
  public readonly row: THelmReleaseRow | null

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: true })
  public readonly activeTab: string

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get tabs(): TTab[] {
    return HelmDetailTabs.all()
  }

  public get panelLabel(): string {
    return this.row ? `Helm release ${this.row.name}` : 'Release details'
  }

  public get subtitle(): string {
    return this.row ? `${this.row.namespace} · revision ${this.row.revision}` : ''
  }

  public get tone(): TUiTone {
    return this.row ? HelmToneMap.ofRelease(this.row.status) : 'unknown'
  }
}
</script>
