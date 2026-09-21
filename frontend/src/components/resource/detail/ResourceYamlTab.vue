<template>
  <div class="flex min-h-0 flex-1 flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-muted-foreground">{{ changeSummary }}</span>

      <span v-if="modeLabel" class="pill pill-active shrink-0 px-1.5 py-0">{{ modeLabel }}</span>

      <div class="ml-auto flex items-center gap-1">
        <button
            :disabled="!dirty || state.applying"
            class="btn-ghost h-7 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
            @click="revert"
        >
          <undo-2 :size="14" />
          Revert
        </button>

        <button
            :disabled="!canApply"
            class="btn-primary h-7 px-3 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            @click="apply"
        >
          <loader-circle v-if="state.applying" :size="14" class="animate-spin" />
          Apply
        </button>
      </div>
    </div>

    <p v-if="parseError" class="text-xs text-destructive" role="alert">{{ parseError }}</p>

    <p v-else-if="ignoredNote" class="text-xs text-muted-foreground">{{ ignoredNote }}</p>

    <resource-yaml-conflict
        v-if="hasConflict"
        :cluster-text="conflictText"
        :draft-text="draft"
        @dismiss="objectStore.dismissConflict(target)"
        @reapply="reapply"
        @reload="reload"
    />

    <monaco-editor
        v-model:value="draft"
        :font-size="fontSize"
        :label="editorLabel"
        :marked-lines="markedLines"
        :path="modelPath"
        :readonly="readonly"
        class="min-h-64"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { LoaderCircle, Undo2 } from '@lucide/vue'
import MonacoEditor from '@/components/editor/MonacoEditor.vue'
import ResourceYamlConflict from '@/components/resource/detail/ResourceYamlConflict.vue'
import { KubeSchemaService } from '@/application/services/kubeSchema/KubeSchemaService'
import { MonacoEditorService } from '@/application/services/monacoEditor/MonacoEditorService'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import { YamlDiff } from '@/application/services/resourceYaml/models/YamlDiff'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import type { TYamlApplyPlan } from '@/application/services/resourceYaml/types/TYamlApplyPlan'
import type { TYamlDiffLine } from '@/application/services/resourceYaml/types/TYamlDiffLine'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@Component({
  components: { LoaderCircle, MonacoEditor, ResourceYamlConflict, Undo2 },
})
export default class ResourceYamlTab extends VueBase {
  public static readonly comfortableFontSize: number = 13

  public static readonly compactFontSize: number = 12

  @Prop({ required: true })
  public readonly target: TResourceObjectRef

  @Prop({ required: true })
  public readonly state: TResourceObjectState

  public draft = ''

  public parseError = ''

  constructor(
      @inject(AppUiStore) public readonly uiStore: AppUiStore,
      @inject(ResourceObjectStore) public readonly objectStore: ResourceObjectStore,
      @inject(ResourceYamlService) private readonly yamlService: ResourceYamlService,
      @inject(KubeSchemaService) private readonly schemaService: KubeSchemaService,
      @inject(MonacoEditorService) private readonly editorService: MonacoEditorService,
  ) {
    super()
  }

  public get original(): string {
    return this.state.loaded ? YamlDocument.text(this.state.object) : ''
  }

  public get dirty(): boolean {
    return this.draft !== this.original
  }

  public get readonly(): boolean {
    return !this.target.kind.canPatch && !this.target.kind.canUpdate
  }

  public get canApply(): boolean {
    return this.dirty && !this.state.applying && !this.readonly
  }

  public get modelPath(): string {
    return `inmemory://kubiq/${encodeURIComponent(ResourceObjectStore.keyOf(this.target))}.yaml`
  }

  public get editorLabel(): string {
    return `Manifest of ${this.target.kind.kind} ${this.target.name}`
  }

  public get fontSize(): number {
    return this.uiStore.density === 'comfortable'
        ? ResourceYamlTab.comfortableFontSize
        : ResourceYamlTab.compactFontSize
  }

  public get diffLines(): TYamlDiffLine[] {
    return this.dirty ? YamlDiff.of(this.original, this.draft) : []
  }

  public get markedLines(): number[] {
    return YamlDiff.touchedLines(this.diffLines)
  }

  public get changeSummary(): string {
    if (this.readonly) {
      return 'Read only — this cluster does not let you write this kind'
    }
    if (!this.dirty) {
      return 'No changes'
    }

    const summary = YamlDiff.summary(this.diffLines)

    return `${summary.added} added, ${summary.removed} removed`
  }

  public get plan(): TYamlApplyPlan | null {
    if (!this.dirty || this.parseError !== '') {
      return null
    }

    const parsed = YamlDocument.tryParse(this.draft)
    if (parsed.error !== '') {
      return null
    }

    try {
      return this.yamlService.plan(this.target.clusterId, this.target.kind, this.state.object, parsed.document)
    } catch {
      return null
    }
  }

  public get modeLabel(): string {
    const plan = this.plan
    if (!plan || plan.mode === 'noop') {
      return ''
    }

    return plan.mode === 'replace' ? 'Replaces the object' : `Patches ${plan.fields.join(', ')}`
  }

  public get ignoredNote(): string {
    const ignored = this.plan?.ignored ?? []

    return ignored.length === 0
        ? ''
        : `${ignored.join(', ')} is reported by the cluster and will not be sent.`
  }

  public get hasConflict(): boolean {
    return Object.keys(this.state.conflict).length > 0
  }

  public get conflictText(): string {
    return this.hasConflict ? YamlDocument.text(this.state.conflict) : ''
  }

  created(): void {
    this.draft = this.original
  }

  async mounted(): Promise<void> {
    await this.loadSchema()
  }

  @Watch('original')
  originalChanged(original: string): void {
    this.draft = original
    this.parseError = ''
  }

  @Watch('draft')
  draftChanged(): void {
    this.parseError = ''
  }

  public revert(): void {
    this.draft = this.original
    this.parseError = ''
  }

  public async apply(): Promise<void> {
    const parsed = YamlDocument.tryParse(this.draft)
    if (parsed.error !== '') {
      this.parseError = parsed.detail === '' ? parsed.error : `${parsed.error}. ${parsed.detail}`
      return
    }

    await this.objectStore.apply(this.target, parsed.document)
  }

  public reload(): void {
    this.objectStore.takeConflict(this.target)
  }

  // Only valid once the conflict diff has been shown: this rebases the draft onto the cluster's version.
  public async reapply(): Promise<void> {
    const parsed = YamlDocument.tryParse(this.draft)
    if (parsed.error !== '') {
      this.parseError = parsed.detail === '' ? parsed.error : `${parsed.error}. ${parsed.detail}`
      return
    }

    await this.objectStore.apply(this.target, this.objectStore.rebase(this.target, parsed.document))
  }

  // A cluster that does not serve OpenAPI v3 gets an editor without completion rather than an error.
  private async loadSchema(): Promise<void> {
    const kind = this.target.kind
    const schema = await this.schemaService.forKind(this.target.clusterId, kind)
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
