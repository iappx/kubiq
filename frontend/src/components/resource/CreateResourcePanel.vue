<template>
  <ui-side-panel
      :open="open"
      :width="width"
      label="Create resource from YAML"
      @close="$emit('close')"
      @update:width="$emit('update:width', $event)"
  >
    <template #title>Create resource</template>
    <template #subtitle>{{ subtitle }}</template>

    <div class="flex h-full min-h-0 flex-col gap-2">
      <p class="shrink-0 text-xs text-muted-foreground">
        The kind comes from the manifest, so anything this cluster serves can be created here —
        a built-in kind or a custom resource.
      </p>

      <p v-if="error" class="shrink-0 text-xs text-destructive" role="alert">{{ error }}</p>

      <monaco-editor
          v-model:value="draft"
          :font-size="fontSize"
          :marked-lines="[]"
          label="Manifest of the object to create"
          path="inmemory://kubiq/new-resource.yaml"
      />
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button class="btn-ghost h-8 px-3 text-xs" type="button" @click="$emit('close')">Cancel</button>
        <button
            :disabled="busy"
            class="btn-primary h-8 px-3 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            @click="submit"
        >
          <loader-circle v-if="busy" :size="14" class="animate-spin" />
          Create
        </button>
      </div>
    </template>
  </ui-side-panel>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { LoaderCircle } from '@lucide/vue'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'
import { ResourceManifestValidator } from '@/application/validators/ResourceManifestValidator'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import { CreateResourceTemplate } from '@/components/resource/CreateResourceTemplate'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeManifest } from '@/domain/models/kube'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'

@Component({
  components: { LoaderCircle, MonacoEditor, UiSidePanel },
  emits: ['close', 'created', 'update:width'],
})
export default class CreateResourcePanel extends VueBase {
  public static readonly comfortableFontSize: number = 13

  public static readonly compactFontSize: number = 12

  @Prop({ required: true })
  public readonly open: boolean

  @Prop({ required: true })
  public readonly clusterId: string

  @Prop({ required: true })
  public readonly width: number

  @Prop({ required: true })
  public readonly served: KubeResourceKind[]

  @Prop({ required: false, default: '' })
  public readonly namespace?: string

  @Prop({ required: false, default: null })
  public readonly kind: KubeResourceKind | null

  public draft = ''

  public error = ''

  public busy = false

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ResourceObjectStore) private readonly objectStore: ResourceObjectStore,
      @inject(ResourceManifestValidator) private readonly validator: ResourceManifestValidator,
  ) {
    super()
  }

  public get subtitle(): string {
    return this.namespace ? `Into ${this.namespace} unless the manifest says otherwise` : 'Into this cluster'
  }

  public get fontSize(): number {
    return this.uiStore.density === 'comfortable'
        ? CreateResourcePanel.comfortableFontSize
        : CreateResourcePanel.compactFontSize
  }

  created(): void {
    this.draft = CreateResourceTemplate.of(this.kind, this.namespace ?? '')
  }

  @Watch('open')
  openChanged(open: boolean): void {
    if (open) {
      this.draft = CreateResourceTemplate.of(this.kind, this.namespace ?? '')
      this.error = ''
    }
  }

  public async submit(): Promise<void> {
    const result = this.validator.validate({ manifest: this.draft, served: this.served })
    this.error = result.errors.manifest ?? ''
    if (!result.valid) {
      return
    }

    const document = YamlDocument.tryParse(this.draft).document
    const kind = ResourceManifestValidator.locate(
        this.served,
        KubeManifest.apiVersionOf(document),
        KubeManifest.kindOf(document),
    )
    if (!kind) {
      return
    }

    this.busy = true
    try {
      const created = await this.objectStore.create({
        clusterId: this.clusterId,
        kind,
        namespace: this.namespace ?? '',
        document,
      })

      if (created) {
        this.$emit('created', { kind, ...created })
      }
    } finally {
      this.busy = false
    }
  }
}
</script>
