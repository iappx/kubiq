<template>
  <ui-side-panel
      :label="row ? `Cluster ${row.name}` : 'Cluster'"
      :open="!!row"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>{{ row?.name }}</template>
    <template #subtitle>{{ row?.server }}</template>

    <template #actions>
      <button
          v-if="row"
          :aria-label="row.isPinned ? `Unpin ${row.name}` : `Pin ${row.name}`"
          :title="row.isPinned ? `Unpin ${row.name}` : `Pin ${row.name}`"
          class="btn-icon w-7 h-7"
          type="button"
          @click="$emit('toggle-pin', row.clusterId)"
      >
        <pin-off v-if="row.isPinned" :size="14" />
        <pin v-else :size="14" />
      </button>
    </template>

    <template v-if="row">
      <div class="flex items-center justify-between gap-2">
        <ui-status-badge :label="row.statusTitle" :tone="tone" />
        <span v-if="row.isCurrent" class="pill">Current context</span>
      </div>

      <p v-if="row.detail" :class="['text-xs leading-relaxed', detailClass]">{{ row.detail }}</p>

      <dl class="space-y-2">
        <cluster-fact-row :value="row.clusterName" label="Cluster" />
        <cluster-fact-row :value="row.server" label="Server" />
        <cluster-fact-row :value="row.namespace" label="Default namespace" />
        <cluster-fact-row :value="row.authType" label="Authentication" />
        <cluster-fact-row :value="row.version" label="Server version" />
        <cluster-fact-row :value="row.filePath" label="Kubeconfig" />
      </dl>

      <section v-if="row.status === 'connected'" aria-label="Namespace scope" class="space-y-2 pt-1">
        <h3 class="text-xs font-medium text-foreground">Namespaces</h3>
        <ui-multi-select
            :model-value="namespaces"
            :options="namespaceOptions"
            label="Namespaces in scope"
            placeholder="All namespaces"
            @update:model-value="$emit('update:namespaces', $event)"
        />
        <p class="text-xs text-muted-foreground">
          Choosing none keeps every namespace in scope. The choice is remembered between sessions.
        </p>
      </section>
    </template>

    <template #footer>
      <div v-if="row" class="flex w-full items-center gap-2">
        <template v-if="row.status === 'connected'">
          <button class="btn-primary" type="button" @click="$emit('enter', row.clusterId)">
            <arrow-right :size="14" />
            Open
          </button>
          <button class="btn-secondary" type="button" @click="$emit('disconnect', row.clusterId)">
            <unplug :size="14" />
            Disconnect
          </button>
        </template>

        <button
            v-else
            :disabled="row.status === 'connecting' || row.status === 'unsupported'"
            class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            @click="$emit('enter', row.clusterId)"
        >
          <loader-circle v-if="row.status === 'connecting'" :size="14" class="animate-spin" />
          <plug v-else :size="14" />
          {{ primaryLabel }}
        </button>

        <button
            v-if="canDelete"
            :aria-label="`Delete ${row.name}`"
            :title="`Delete ${row.name}`"
            class="btn-icon ml-auto h-7 w-7 hover:text-destructive"
            type="button"
            @click="$emit('delete', row)"
        >
          <trash-2 :size="14" />
        </button>
      </div>
    </template>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { ArrowRight, LoaderCircle, Pin, PinOff, Plug, Trash2, Unplug } from '@lucide/vue'
import ClusterFactRow from '@/components/cluster/ClusterFactRow.vue'
import UiMultiSelect from '@/components/common/select/UiMultiSelect.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: {
    ArrowRight,
    ClusterFactRow,
    LoaderCircle,
    Pin,
    PinOff,
    Plug,
    Trash2,
    UiMultiSelect,
    UiSidePanel,
    UiStatusBadge,
    Unplug,
  },
  emits: ['close', 'update:width', 'enter', 'disconnect', 'toggle-pin', 'delete', 'update:namespaces'],
})
export default class ClusterDetailPanel extends VueBase {
  @Prop({ required: false, default: null })
  public readonly row: TClusterRow | null

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: () => [] })
  public readonly namespaces?: string[]

  @Prop({ required: false, default: () => [] })
  public readonly namespaceOptions?: TUiSelectOption[]

  public get tone(): TUiTone {
    return this.row ? ClusterToneMap.of(this.row.status) : 'unknown'
  }

  public get canDelete(): boolean {
    return !!this.row && this.row.sourceOrigin !== 'discovered'
  }

  public get primaryLabel(): string {
    return this.row?.status === 'connecting' ? 'Connecting' : 'Connect and open'
  }

  public get detailClass(): string {
    if (!this.row) {
      return 'text-muted-foreground'
    }

    return this.row.status === 'unreachable' ? 'text-destructive' : 'text-warning'
  }
}
</script>
