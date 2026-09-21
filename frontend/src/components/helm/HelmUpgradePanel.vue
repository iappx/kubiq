<template>
  <ui-side-panel
      :label="panelLabel"
      :open="open"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>Upgrade {{ release?.name }}</template>
    <template #subtitle>{{ subtitle }}</template>

    <div class="flex h-full min-h-0 flex-col gap-3">
      <div class="shrink-0 space-y-3">
        <helm-text-field
            v-model="chart"
            :disabled="busy"
            :error="fieldErrors.chart"
            label="Chart"
            placeholder="bitnami/nginx"
        />

        <helm-text-field
            v-model="version"
            :disabled="busy"
            :error="fieldErrors.version"
            label="Chart version"
            placeholder="Leave empty for the newest version in the repository"
        />

        <ui-toggle
            v-model="reuseValues"
            description="Merge the values below into what the release already stores, instead of replacing them"
            label="Keep the stored values"
        />
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-sm text-muted-foreground">Values</span>
          <span v-if="fieldErrors.values" class="text-xs text-destructive" role="alert">{{ fieldErrors.values }}</span>
        </div>

        <monaco-editor
            v-model:value="values"
            :label="`Values for ${release?.name}`"
            :path="modelPath"
            :readonly="busy"
            class="min-h-48"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button :disabled="busy" class="btn-ghost disabled:opacity-50" type="button" @click="$emit('close')">
          Cancel
        </button>
        <button :disabled="busy" class="btn-primary disabled:opacity-70" type="button" @click="submit">
          <loader-circle v-if="busy" :size="14" class="animate-spin" />
          Upgrade
        </button>
      </div>
    </template>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, Watch, VueBase } from '@iappx/vue-facing-di'
import { LoaderCircle } from '@lucide/vue'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import UiToggle from '@/components/common/toggle/UiToggle.vue'
import HelmTextField from '@/components/helm/HelmTextField.vue'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'
import type { THelmUpgradeDraft } from '@/domain/entities/helm/types/THelmUpgradeDraft'

@Component({
  components: { HelmTextField, LoaderCircle, MonacoEditor, UiSidePanel, UiToggle },
  emits: ['close', 'submit', 'update:width'],
})
export default class HelmUpgradePanel extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: null })
  public readonly release: THelmReleaseRow | null

  @Prop({ required: false, default: '' })
  public readonly initialChart?: string

  @Prop({ required: false, default: '' })
  public readonly initialValues?: string

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  @Prop({ required: false, default: () => ({}) })
  public readonly errors?: Record<string, string>

  public chart = ''

  public version = ''

  public values = ''

  public reuseValues = false

  public get fieldErrors(): Record<string, string> {
    return this.errors ?? {}
  }

  public get panelLabel(): string {
    return `Upgrade the Helm release ${this.release?.name ?? ''}`
  }

  public get subtitle(): string {
    return this.release ? `${this.release.namespace} · currently ${this.release.chart} ${this.release.chartVersion}` : ''
  }

  public get modelPath(): string {
    return `inmemory://kubiq/helm/upgrade/${encodeURIComponent(this.release?.namespace ?? '')}/${encodeURIComponent(this.release?.name ?? '')}.yaml`
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.reset()
    }
  }

  public submit(): void {
    if (!this.release) {
      return
    }

    const draft: THelmUpgradeDraft = {
      releaseName: this.release.name,
      namespace: this.release.namespace,
      chart: this.chart.trim(),
      version: this.version.trim(),
      values: this.values,
      reuseValues: this.reuseValues,
    }

    this.$emit('submit', draft)
  }

  private reset(): void {
    this.chart = this.initialChart ?? ''
    this.version = ''
    this.values = this.initialValues ?? ''
    this.reuseValues = false
  }
}
</script>
