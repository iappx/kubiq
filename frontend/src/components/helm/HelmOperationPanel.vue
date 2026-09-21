<template>
  <ui-side-panel
      :label="panelLabel"
      :open="!!operation"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>{{ operation?.title }}</template>
    <template #subtitle>{{ subtitle }}</template>

    <template #actions>
      <button
          v-if="isRunning"
          aria-label="Stop this helm command"
          class="btn-icon w-7 h-7 text-destructive"
          title="Stop this helm command"
          type="button"
          @click="$emit('cancel')"
      >
        <square :size="14" />
      </button>
    </template>

    <div v-if="operation" class="flex h-full min-h-0 flex-col gap-2">
      <div class="flex shrink-0 items-center gap-2">
        <ui-status-badge :label="stateLabel" :tone="tone" />
        <loader-circle v-if="isRunning" :size="14" class="animate-spin text-muted-foreground" />
        <span class="ml-auto text-xs text-muted-foreground tabular">{{ operation.lineCount }} lines</span>
      </div>

      <p v-if="operation.lineCount === 0 && isRunning" class="text-xs text-muted-foreground">
        helm has not written anything yet. This panel is not blocking anything — close it and the command keeps running.
      </p>

      <helm-output-view :lines="lines" :revision="operation.revision" />
    </div>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle, Square } from '@lucide/vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiStatusBadge from '@/components/common/status/UiStatusBadge.vue'
import HelmOutputView from '@/components/helm/HelmOutputView.vue'
import { HelmToneMap } from '@/components/helm/HelmToneMap'
import type { THelmOperationView } from '@/store/modules/helm/types/THelmOperationView'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

@Component({
  components: { HelmOutputView, LoaderCircle, Square, UiSidePanel, UiStatusBadge },
  emits: ['close', 'cancel', 'update:width'],
})
export default class HelmOperationPanel extends VueBase {
  private static readonly labels: Record<string, string> = {
    running: 'Running',
    succeeded: 'Finished',
    failed: 'Failed',
    cancelled: 'Stopped',
  }

  @Prop({ required: false, default: null })
  public readonly operation: THelmOperationView | null

  @Prop({ required: true })
  public readonly lines: readonly string[]

  @Prop({ required: true })
  public readonly width: number

  public get isRunning(): boolean {
    return this.operation?.state === 'running'
  }

  public get stateLabel(): string {
    const state = this.operation?.state
    if (!state) {
      return ''
    }

    return state === 'failed' && this.operation
        ? `${HelmOperationPanel.labels.failed} · exit ${this.operation.code}`
        : HelmOperationPanel.labels[state] ?? state
  }

  public get tone(): TUiTone {
    return this.operation ? HelmToneMap.ofOperation(this.operation.state) : 'unknown'
  }

  public get panelLabel(): string {
    return this.operation ? this.operation.title : 'Helm command'
  }

  public get subtitle(): string {
    return this.operation ? `${this.operation.namespace} · ${this.operation.releaseName}` : ''
  }
}
</script>
