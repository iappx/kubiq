<template>
  <ui-modal
      v-model="isOpen"
      :loading="isBusy"
      submit-label="Add"
      title="Add kubeconfig"
      @close="$emit('close')"
      @submit="submit"
  >
    <ui-form-field v-if="isFileMode" v-slot="{ fieldId, describedBy }" :error="errors.path" label="Kubeconfig file">
      <div class="flex gap-2">
        <input
            :id="fieldId"
            ref="field"
            v-model="draft.path"
            :aria-describedby="describedBy"
            :aria-invalid="errors.path ? 'true' : undefined"
            autocomplete="off"
            class="ui-input min-w-0 flex-1"
            placeholder="D:/work/clusters/staging.yaml"
            spellcheck="false"
            type="text"
            @keydown.enter.prevent="submit"
        >
        <button v-if="canBrowse" class="btn-secondary shrink-0" type="button" @click="browse">
          <folder-open :size="14" />
          Browse
        </button>
      </div>
    </ui-form-field>

    <ui-form-field v-else v-slot="{ fieldId, describedBy }" :error="errors.text" label="Kubeconfig contents">
      <textarea
          :id="fieldId"
          ref="field"
          v-model="draft.text"
          :aria-describedby="describedBy"
          :aria-invalid="errors.text ? 'true' : undefined"
          class="ui-input h-48 font-mono text-xs"
          placeholder="apiVersion: v1&#10;kind: Config&#10;clusters:&#10;  - name: staging"
          spellcheck="false"
      />
    </ui-form-field>

    <button class="mt-2 text-xs text-primary hover:underline" type="button" @click="switchMode">
      {{ switchLabel }}
    </button>

    <p v-if="isFileMode" class="text-xs text-muted-foreground mt-3">
      Kubiq reads the file where it is and never copies it. Environment variables such as
      <code class="text-foreground">$HOME</code> are expanded.
    </p>
    <p v-else class="text-xs text-muted-foreground mt-3">
      Kubiq saves what you paste as a file of its own under
      <code class="text-foreground">{{ storageDirectory }}</code> in the app data folder and reads the
      clusters from there. Whatever the text carries — tokens, keys — is written to this machine.
    </p>
  </ui-modal>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { nextTick } from 'vue'
import { FolderOpen } from '@lucide/vue'
import UiFormField from '@/components/common/form/UiFormField.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import { KubeconfigImportService } from '@/application/services/kubeconfigImport/KubeconfigImportService'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'
import { KubeconfigSourceValidator } from '@/application/validators/KubeconfigSourceValidator'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { FileDialogAdapter } from '@/infrastructure/wails/FileDialogAdapter'
import type { TKubeconfigSourceDraft } from '@/domain/entities/catalog/types/TKubeconfigSourceDraft'
import type { TFileDialogFilter } from '@/infrastructure/wails/types/TFileDialogFilter'

@Component({
  components: { FolderOpen, UiFormField, UiModal },
  emits: ['close', 'submit'],
})
export default class AddKubeconfigModal extends VueBase {
  private static readonly filters: TFileDialogFilter[] = [
    { title: 'Kubeconfig files', pattern: '*.yaml;*.yml;*.conf;*.config;config' },
    { title: 'All files', pattern: '*' },
  ]

  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: false, default: false })
  public readonly busy?: boolean

  public draft: TKubeconfigSourceDraft = AddKubeconfigModal.blank()

  public errors: Record<string, string> = {}

  public saving = false

  constructor(
      @inject(KubeconfigSourceValidator) private readonly validator: KubeconfigSourceValidator,
      @inject(KubeconfigImportService) private readonly importService: KubeconfigImportService,
      @inject(FileDialogAdapter) private readonly fileDialog: FileDialogAdapter,
      @inject(EventBus) private readonly eventBus: EventBus,
  ) {
    super()
  }

  public get isOpen(): boolean {
    return this.open
  }

  public set isOpen(value: boolean) {
    if (!value) {
      this.$emit('close')
    }
  }

  public get isFileMode(): boolean {
    return this.draft.mode === 'file'
  }

  public get isBusy(): boolean {
    return this.busy === true || this.saving
  }

  public get canBrowse(): boolean {
    return this.fileDialog.isAvailable
  }

  public get switchLabel(): string {
    return this.isFileMode ? 'Paste the contents instead' : 'Choose a file instead'
  }

  public get storageDirectory(): string {
    return PastedKubeconfig.directory
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.draft = AddKubeconfigModal.blank()
      this.errors = {}
      this.saving = false
    }
  }

  public async switchMode(): Promise<void> {
    this.draft = { ...this.draft, mode: this.isFileMode ? 'paste' : 'file' }
    this.errors = {}

    await nextTick()
    this.focusField()
  }

  public async browse(): Promise<void> {
    try {
      const selected = await this.fileDialog.openFile({
        title: 'Choose a kubeconfig file',
        filters: AddKubeconfigModal.filters,
      })

      if (selected !== '') {
        this.draft = { ...this.draft, path: selected }
        this.errors = {}
      }
    } catch (err) {
      this.eventBus.emitEvent(new AppErrorEvent(err, 'AddKubeconfigModal.browse'))
    }
  }

  public async submit(): Promise<void> {
    if (this.isBusy) {
      return
    }

    const result = this.validator.validate(this.draft)
    this.errors = result.errors

    if (!result.valid) {
      return
    }

    if (this.isFileMode) {
      this.$emit('submit', this.draft.path.trim())
      return
    }

    await this.saveAndSubmit()
  }

  private async saveAndSubmit(): Promise<void> {
    this.saving = true

    try {
      this.$emit('submit', await this.importService.save(this.draft.text))
    } catch (err) {
      this.eventBus.emitEvent(new AppErrorEvent(err, 'AddKubeconfigModal.submit'))
    } finally {
      this.saving = false
    }
  }

  private focusField(): void {
    const field = this.$refs.field as HTMLElement | undefined

    field?.focus()
  }

  private static blank(): TKubeconfigSourceDraft {
    return { mode: 'file', path: '', text: '' }
  }
}
</script>
