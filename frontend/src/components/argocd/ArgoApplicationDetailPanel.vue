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
          v-if="canSync"
          :aria-label="`Sync ${row?.name}`"
          :disabled="busy"
          class="btn-icon w-7 h-7 disabled:opacity-50"
          title="Sync"
          type="button"
          @click="$emit('sync')"
      >
        <refresh-cw :size="14" />
      </button>

      <button
          v-if="canSync"
          :aria-label="`Refresh ${row?.name}`"
          :disabled="busy"
          class="btn-icon w-7 h-7 disabled:opacity-50"
          title="Refresh"
          type="button"
          @click="$emit('refresh')"
      >
        <refresh-ccw-dot :size="14" />
      </button>

      <button
          v-if="canSync && row?.isOperationRunning"
          :aria-label="`Stop the running sync of ${row?.name}`"
          :disabled="busy"
          class="btn-icon w-7 h-7 disabled:opacity-50"
          title="Stop the running sync"
          type="button"
          @click="$emit('terminate')"
      >
        <circle-stop :size="14" />
      </button>

      <button
          v-if="canDelete"
          :aria-label="`Delete ${row?.name}`"
          :disabled="busy"
          class="btn-icon w-7 h-7 text-destructive disabled:opacity-50"
          title="Delete"
          type="button"
          @click="$emit('remove')"
      >
        <trash2 :size="14" />
      </button>
    </template>

    <!-- h-full, not auto: the body owns the scrolling, which is what keeps the tab bar in place. -->
    <div v-if="row" class="flex h-full min-h-0 flex-col gap-3">
      <div class="shrink-0 space-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <ui-status-badge :label="row.syncText" :tone="syncTone" />
          <ui-status-badge :label="row.healthText" :tone="healthTone" />
        </div>

        <ui-tab-bar :active="activeTab" :tabs="tabs" class="mb-0" @change="$emit('update:active-tab', $event)" />
      </div>

      <slot />
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { CircleStop, RefreshCcwDot, RefreshCw, Trash2 } from '@lucide/vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import { ArgoDetailTabs } from '@/components/argocd/detail/ArgoDetailTabs'
import { ArgoToneMap } from '@/components/argocd/ArgoToneMap'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { CircleStop, RefreshCcwDot, RefreshCw, Trash2, UiSidePanel, UiStatusBadge, UiTabBar },
  emits: ['close', 'sync', 'refresh', 'terminate', 'remove', 'update:width', 'update:active-tab'],
})
export default class ArgoApplicationDetailPanel extends VueBase {
  @Prop({ required: false, default: null })
  public readonly row: TArgoApplicationRow | null

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: true })
  public readonly activeTab: string

  @Prop({ required: false, default: false })
  public readonly canSync?: boolean

  @Prop({ required: false, default: false })
  public readonly canDelete?: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public get tabs(): TTab[] {
    return ArgoDetailTabs.all()
  }

  public get panelLabel(): string {
    return this.row ? `Argo CD application ${this.row.name}` : 'Application details'
  }

  public get subtitle(): string {
    if (!this.row) {
      return ''
    }

    const destination = this.row.destinationNamespace || this.row.destination

    return destination === '' ? this.row.project : `${this.row.project} · ${destination}`
  }

  public get syncTone(): TUiTone {
    return this.row ? ArgoToneMap.ofSync(this.row.syncStatus) : 'unknown'
  }

  public get healthTone(): TUiTone {
    return this.row ? ArgoToneMap.ofHealth(this.row.healthStatus) : 'unknown'
  }
}
</script>
