<template>
  <ui-side-panel
      :label="panelLabel"
      :open="!!chart"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>{{ chart?.ref }}</template>
    <template #subtitle>{{ subtitle }}</template>

    <template #actions>
      <button
          :aria-label="`Install ${chart?.ref}`"
          class="btn-icon w-7 h-7"
          title="Install"
          type="button"
          @click="$emit('install')"
      >
        <download :size="14" />
      </button>
    </template>

    <div v-if="chart" class="flex h-full min-h-0 flex-col gap-3">
      <div class="shrink-0">
        <ui-tab-bar :active="activeTab" :tabs="tabs" class="mb-0" @change="$emit('update:active-tab', $event)" />
      </div>

      <ui-error-state
          v-if="error"
          :message="error"
          :retryable="false"
          title="Could not read this chart"
      />

      <ui-deferred-loader v-else-if="loading" :loading="true">
        <template #loading>
          <ui-skeletons :count="3" type="rows" />
        </template>
      </ui-deferred-loader>

      <template v-else-if="detail">
        <pre
            v-if="activeTab === readmeKey"
            class="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 text-xs text-foreground"
        >{{ detail.readme || 'This chart ships no README.' }}</pre>

        <monaco-editor
            v-else
            :label="`Default values of ${chart.ref}`"
            :path="modelPath"
            :value="detail.values"
            class="min-h-48"
            readonly
        />
      </template>
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { Download } from '@lucide/vue'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import UiDeferredLoader from '@/components/common/feedback/UiDeferredLoader.vue'
import UiErrorState from '@/components/common/feedback/UiErrorState.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiSkeletons from '@/components/common/UiSkeletons.vue'
import UiTabBar from '@/components/common/tabBar/UiTabBar.vue'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import type { THelmChartRow } from '@/components/helm/types/THelmChartRow'
import type { THelmChartDetail } from '@/store/modules/helm/types/THelmChartDetail'

@Component({
  components: { Download, MonacoEditor, UiDeferredLoader, UiErrorState, UiSidePanel, UiSkeletons, UiTabBar },
  emits: ['close', 'install', 'update:width', 'update:active-tab'],
})
export default class HelmChartDetailPanel extends VueBase {
  public static readonly readmeKey: string = 'readme'

  public static readonly valuesKey: string = 'values'

  @Prop({ required: false, default: null })
  public readonly chart: THelmChartRow | null

  @Prop({ required: false, default: null })
  public readonly detail: THelmChartDetail | null

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: true })
  public readonly activeTab: string

  @Prop({ required: false, default: false })
  public readonly loading?: boolean

  @Prop({ required: false, default: '' })
  public readonly error?: string

  public get readmeKey(): string {
    return HelmChartDetailPanel.readmeKey
  }

  public get tabs(): TTab[] {
    return [
      { key: HelmChartDetailPanel.readmeKey, label: 'README' },
      { key: HelmChartDetailPanel.valuesKey, label: 'Default values' },
    ]
  }

  public get panelLabel(): string {
    return this.chart ? `Helm chart ${this.chart.ref}` : 'Chart details'
  }

  public get subtitle(): string {
    return this.chart ? `${this.chart.version} · app ${this.chart.appVersion || '—'}` : ''
  }

  public get modelPath(): string {
    return `inmemory://kubiq/helm/chart/${encodeURIComponent(this.chart?.id ?? '')}/values.yaml`
  }
}
</script>
