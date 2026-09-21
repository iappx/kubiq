<template>
  <ui-side-panel
      :label="panelLabel"
      :open="open"
      :width="width"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>Install a chart</template>
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

        <helm-text-field
            v-model="releaseName"
            :disabled="busy"
            :error="fieldErrors.releaseName"
            label="Release name"
            placeholder="my-nginx"
        />

        <helm-namespace-field
            v-model="namespace"
            :disabled="busy"
            :error="fieldErrors.namespace"
            :namespaces="namespaces"
        />

        <ui-toggle
            v-model="createNamespace"
            description="Helm creates the namespace when it is missing, instead of refusing the install"
            label="Create the namespace"
        />
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-sm text-muted-foreground">Values</span>
          <span v-if="fieldErrors.values" class="text-xs text-destructive" role="alert">{{ fieldErrors.values }}</span>
        </div>

        <monaco-editor
            v-model:value="values"
            :path="modelPath"
            :readonly="busy"
            class="min-h-48"
            label="Values for the new release"
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
          Install
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
import HelmNamespaceField from '@/components/helm/HelmNamespaceField.vue'
import HelmTextField from '@/components/helm/HelmTextField.vue'
import { HelmChartRef } from '@/domain/models/helm/HelmChartRef'
import type { THelmInstallDraft } from '@/domain/entities/helm/types/THelmInstallDraft'

@Component({
  components: { HelmNamespaceField, HelmTextField, LoaderCircle, MonacoEditor, UiSidePanel, UiToggle },
  emits: ['close', 'submit', 'update:width'],
})
export default class HelmInstallPanel extends VueBase {
  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: '' })
  public readonly initialChart?: string

  @Prop({ required: false, default: '' })
  public readonly initialVersion?: string

  @Prop({ required: false, default: '' })
  public readonly initialValues?: string

  @Prop({ required: false, default: '' })
  public readonly initialNamespace?: string

  @Prop({ required: false, default: () => [] })
  public readonly namespaces?: string[]

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  @Prop({ required: false, default: () => ({}) })
  public readonly errors?: Record<string, string>

  public chart = ''

  public version = ''

  public releaseName = ''

  public namespace = ''

  public values = ''

  public createNamespace = false

  public get fieldErrors(): Record<string, string> {
    return this.errors ?? {}
  }

  public get panelLabel(): string {
    return 'Install a Helm chart'
  }

  public get subtitle(): string {
    return this.chart === '' ? 'Name a chart from one of the repositories' : this.chart
  }

  public get modelPath(): string {
    return 'inmemory://kubiq/helm/install/values.yaml'
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.reset()
    }
  }

  public submit(): void {
    const draft: THelmInstallDraft = {
      releaseName: this.releaseName.trim(),
      namespace: this.namespace.trim(),
      createNamespace: this.createNamespace,
      chart: this.chart.trim(),
      version: this.version.trim(),
      values: this.values,
    }

    this.$emit('submit', draft)
  }

  private reset(): void {
    this.chart = this.initialChart ?? ''
    this.version = this.initialVersion ?? ''
    this.values = this.initialValues ?? ''
    this.namespace = this.initialNamespace ?? ''
    this.createNamespace = false
    this.releaseName = HelmChartRef.chartOf(this.chart)
  }
}
</script>
