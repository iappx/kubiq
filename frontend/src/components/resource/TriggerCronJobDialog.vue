<template>
  <ui-modal
      :loading="busy"
      :open="open"
      :title="title"
      submit-label="Run"
      wide
      @close="$emit('cancel')"
      @submit="submit"
  >
    <div class="flex h-[60vh] min-h-64 flex-col gap-2">
      <p class="shrink-0 text-xs text-muted-foreground">
        The job the cron job would create, marked as a manual run. Whatever is changed here goes into this
        run only — the cron job itself stays as it is.
      </p>

      <p v-if="error" class="shrink-0 text-xs text-destructive" role="alert">{{ error }}</p>

      <monaco-editor
          v-model:value="draft"
          :font-size="fontSize"
          :label="`Manifest of the job to run from CronJob ${cronJob?.name ?? ''}`"
          :marked-lines="[]"
          :path="modelPath"
      />
    </div>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import { KubeSchemaService } from '@/application/services/kubeSchema/KubeSchemaService'
import { MonacoEditorService } from '@/application/services/monacoEditor/MonacoEditorService'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import { WorkloadActionService } from '@/application/services/workloadAction/WorkloadActionService'
import { CronJobRunValidator } from '@/application/validators/CronJobRunValidator'
import type { CronJobEntity } from '@/domain/entities/workloads'
import type { KubeResourceKind } from '@/domain/models/kube'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'

@Component({
  components: { MonacoEditor, UiModal },
  emits: ['run', 'cancel'],
})
export default class TriggerCronJobDialog extends VueBase {
  public static readonly comfortableFontSize: number = 13

  public static readonly compactFontSize: number = 12

  public static readonly modelPath: string = 'inmemory://kubiq/cronjob-run.yaml'

  @Prop({ required: true, type: Boolean })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: false, default: null })
  public readonly cronJob: CronJobEntity | null

  @Prop({ required: false, default: null })
  public readonly jobKind: KubeResourceKind | null

  @Prop({ required: false, type: Boolean, default: false })
  public readonly busy?: boolean

  public draft = ''

  public error = ''

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(CronJobRunValidator) private readonly validator: CronJobRunValidator,
      @inject(KubeSchemaService) private readonly schemaService: KubeSchemaService,
      @inject(MonacoEditorService) private readonly editorService: MonacoEditorService,
  ) {
    super()
  }

  public get title(): string {
    return `Trigger ${this.cronJob?.name ?? 'cron job'} with edits`
  }

  public get modelPath(): string {
    return TriggerCronJobDialog.modelPath
  }

  public get fontSize(): number {
    return this.uiStore.density === 'comfortable'
        ? TriggerCronJobDialog.comfortableFontSize
        : TriggerCronJobDialog.compactFontSize
  }

  @Watch('open')
  async openChanged(open: boolean): Promise<void> {
    if (!open) {
      return
    }

    this.reset()
    await this.loadSchema()
  }

  public submit(): void {
    const jobKind = this.jobKind
    const cronJob = this.cronJob
    if (!jobKind || !cronJob) {
      return
    }

    const result = this.validator.validate({ manifest: this.draft, jobKind, namespace: cronJob.namespace })
    this.error = result.errors.manifest ?? ''

    if (result.valid) {
      this.$emit('run', YamlDocument.tryParse(this.draft).document)
    }
  }

  private reset(): void {
    this.error = ''
    this.draft = this.cronJob && this.jobKind
      ? YamlDocument.text(WorkloadActionService.jobManifest(this.cronJob, this.jobKind))
      : ''
  }

  private async loadSchema(): Promise<void> {
    const kind = this.jobKind
    if (!kind) {
      return
    }

    const schema = await this.schemaService.forKind(this.clusterId, kind)
    if (!schema) {
      return
    }

    await this.editorService.addSchema({
      fileMatch: [this.modelPath],
      uri: `kubiq://schema/${kind.group}/${kind.version}/${kind.kind}`,
      schema,
    })
  }
}
</script>
