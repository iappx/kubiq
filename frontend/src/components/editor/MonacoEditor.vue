<template>
  <div class="relative flex-1 min-h-0">
    <div ref="host" class="absolute inset-0" />

    <div v-if="!ready" class="absolute inset-x-0 top-0">
      <ui-progress-bar label="Loading the editor" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, VModel, VueBase, Watch } from '@iappx/vue-facing-di'
import { inject } from 'tsyringe'
import { markRaw } from 'vue'
import UiProgressBar from '@/components/common/feedback/UiProgressBar.vue'
import { MonacoEditorDefaults } from '@/application/services/monacoEditor/constants/MonacoEditorDefaults'
import { MonacoEditorService } from '@/application/services/monacoEditor/MonacoEditorService'
import type { TMonacoApi } from '@/application/services/monacoEditor/types/TMonacoApi'

type TEditor = ReturnType<TMonacoApi['editor']['create']>
type TModel = ReturnType<TMonacoApi['editor']['createModel']>
type TDecorations = ReturnType<TEditor['createDecorationsCollection']>

@Component({
  components: { UiProgressBar },
  emits: ['update:value', 'ready'],
})
export default class MonacoEditor extends VueBase {
  public static readonly changedLineClass: string = 'ui-editor-line-changed'

  @VModel({ name: 'value' })
  public text: string

  @Prop({ required: true })
  public readonly label: string

  @Prop({ required: true })
  public readonly path: string

  @Prop({ required: false, default: false })
  public readonly readonly?: boolean

  @Prop({ required: false, default: () => [] })
  public readonly markedLines?: number[]

  @Prop({ required: false, default: MonacoEditorDefaults.fontSize })
  public readonly fontSize?: number

  public ready = false

  private editor: TEditor | null = null

  private model: TModel | null = null

  private decorations: TDecorations | null = null

  private monaco: TMonacoApi | null = null

  private writing = false

  constructor(
      @inject(MonacoEditorService) private readonly editorService: MonacoEditorService,
  ) {
    super()
  }

  async mounted(): Promise<void> {
    const monaco = await this.editorService.load()
    const host = this.$refs.host as HTMLElement | undefined
    if (!host) {
      return
    }

    // Every class field here lands in the component's reactive state, and a model handed to
    // monaco through a reactive proxy wraps a fresh proxy around each node of its piece tree
    // as monaco walks it — the editor never finishes opening. Raw, or not at all.
    this.monaco = monaco
    this.model = markRaw(
        monaco.editor.createModel(this.text, MonacoEditorDefaults.language, monaco.Uri.parse(this.path)),
    )
    this.editor = markRaw(monaco.editor.create(host, {
      ...MonacoEditorDefaults.options(),
      model: this.model,
      theme: this.editorService.themeName,
      readOnly: this.readonly === true,
      ariaLabel: this.label,
      fontFamily: this.editorService.fontFamily(),
      fontSize: this.fontSize ?? MonacoEditorDefaults.fontSize,
      lineHeight: MonacoEditorDefaults.lineHeight,
    }))

    this.decorations = markRaw(this.editor.createDecorationsCollection([]))
    this.model.onDidChangeContent(() => this.publish())

    this.ready = true
    this.markLines()
    this.$emit('ready')
  }

  beforeUnmount(): void {
    this.decorations?.clear()
    this.editor?.dispose()
    this.model?.dispose()
    this.editor = null
    this.model = null
  }

  public focus(): void {
    this.editor?.focus()
  }

  @Watch('text')
  textChanged(text: string): void {
    // Writing back the value the editor itself reported would move the caret to the top on every keystroke.
    if (!this.writing && this.model && this.model.getValue() !== text) {
      this.model.setValue(text)
    }
  }

  @Watch('markedLines')
  markedLinesChanged(): void {
    this.markLines()
  }

  @Watch('readonly')
  readonlyChanged(readonly: boolean): void {
    this.editor?.updateOptions({ readOnly: readonly })
  }

  @Watch('fontSize')
  fontSizeChanged(fontSize: number): void {
    this.editor?.updateOptions({ fontSize })
  }

  private publish(): void {
    if (!this.model) {
      return
    }

    this.writing = true
    this.text = this.model.getValue()
    this.writing = false
  }

  private markLines(): void {
    if (!this.monaco || !this.decorations) {
      return
    }

    const monaco = this.monaco
    this.decorations.set((this.markedLines ?? []).map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        linesDecorationsClassName: MonacoEditor.changedLineClass,
      },
    })))
  }
}
</script>
