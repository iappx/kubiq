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
          v-if="canShell"
          :aria-label="`Open a shell in ${row?.name}`"
          class="btn-icon w-7 h-7"
          title="Open shell"
          type="button"
          @click="$emit('shell')"
      >
        <square-terminal :size="14" />
      </button>

      <button
          v-if="canForward"
          :aria-label="`Forward a port of ${row?.name}`"
          class="btn-icon w-7 h-7"
          title="Forward port"
          type="button"
          @click="$emit('forward')"
      >
        <cable :size="14" />
      </button>

      <button
          v-if="canChangeDefault"
          :aria-label="`${defaultActionTitle}: ${row?.name}`"
          :disabled="defaultBusy"
          :title="defaultActionTitle"
          class="btn-icon w-7 h-7"
          type="button"
          @click="$emit(isDefaultClass ? 'unset-default' : 'set-default')"
      >
        <star-off v-if="isDefaultClass" :size="14" />
        <star v-else :size="14" />
      </button>

      <button
          v-if="canDelete"
          :aria-label="`Delete ${row?.name}`"
          class="btn-icon w-7 h-7 text-destructive"
          title="Delete"
          type="button"
          @click="$emit('delete')"
      >
        <trash2 :size="14" />
      </button>
    </template>

    <!-- h-full, not auto: the YAML tab's editor measures the box it was mounted into. -->
    <div v-if="row" class="flex h-full min-h-0 flex-col gap-3">
      <div class="shrink-0 space-y-2">
        <div class="flex items-center gap-3">
          <ui-status-badge :label="row.statusTitle" :tone="row.tone" />
          <ui-status-badge v-if="isDefaultClass" label="Default" tone="info" />
        </div>

        <ui-tab-bar
            v-if="visibleTabs.length > 1"
            :active="activeTab"
            :tabs="visibleTabs"
            class="mb-0"
            @change="$emit('update:active-tab', $event)"
        />
      </div>

      <slot :tab="activeTab" />
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Cable, SquareTerminal, Star, StarOff, Trash2 } from '@lucide/vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeDefaultClassCatalog, KubeWorkloadCatalog } from '@/domain/models/kube'

@Component({
  components: { Cable, SquareTerminal, Star, StarOff, Trash2, UiSidePanel, UiStatusBadge, UiTabBar },
  emits: ['close', 'delete', 'forward', 'shell', 'set-default', 'unset-default', 'update:width', 'update:active-tab'],
})
export default class ResourceDetailPanel extends VueBase {
  public static readonly overviewTab: string = 'overview'

  @Prop({ required: false, default: null })
  public readonly row: TResourceRow | null

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: () => [{ key: ResourceDetailPanel.overviewTab, label: 'Overview' }] })
  public readonly tabs?: TTab[]

  @Prop({ required: false, default: ResourceDetailPanel.overviewTab })
  public readonly activeTab?: string

  @Prop({ required: false, type: Boolean, default: false })
  public readonly defaultBusy?: boolean

  public get visibleTabs(): TTab[] {
    return this.tabs ?? []
  }

  public get panelLabel(): string {
    return this.row ? `${this.kind?.kind ?? 'Object'} ${this.row.name}` : 'Object details'
  }

  public get subtitle(): string {
    return this.row?.namespace ? `${this.row.namespace} · ${this.kind?.apiVersion ?? ''}` : (this.kind?.apiVersion ?? '')
  }

  public get canDelete(): boolean {
    return !!this.row && this.kind?.canDelete === true
  }

  public get canShell(): boolean {
    return !!this.row && !!this.kind && KubeWorkloadCatalog.isPod(this.kind)
  }

  public get canForward(): boolean {
    return !!this.row && !!this.kind && KubeWorkloadCatalog.canForwardPort(this.kind)
  }

  public get isDefaultClass(): boolean {
    return this.row?.isDefault === true
  }

  // A row rebuilt from the address alone carries no flag, and guessing one would offer the wrong action.
  public get canChangeDefault(): boolean {
    return typeof this.row?.isDefault === 'boolean' && !!this.kind && KubeDefaultClassCatalog.canSetDefault(this.kind)
  }

  public get defaultActionTitle(): string {
    return this.isDefaultClass ? 'Unset default' : 'Set as default'
  }
}
</script>
