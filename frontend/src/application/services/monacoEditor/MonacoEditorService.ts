import { inject, singleton } from 'tsyringe'
import { MonacoEditorDefaults } from '@/application/services/monacoEditor/constants/MonacoEditorDefaults'
import { MonacoThemeTokens } from '@/application/services/monacoEditor/constants/MonacoThemeTokens'
import { MonacoThemeBuilder } from '@/application/services/monacoEditor/models/MonacoThemeBuilder'
import type { TMonacoApi } from '@/application/services/monacoEditor/types/TMonacoApi'
import type { TMonacoSchema } from '@/application/services/monacoEditor/types/TMonacoSchema'
import { CssTokenAdapter } from '@/infrastructure/theme/CssTokenAdapter'

@singleton()
export class MonacoEditorService {
    private loading: Promise<TMonacoApi> | null = null

    private api: TMonacoApi | null = null

    private schemas: TMonacoSchema[] = []

    constructor(
        @inject(CssTokenAdapter) private readonly tokens: CssTokenAdapter,
    ) {}

    public get isLoaded(): boolean {
        return this.api !== null
    }

    public get themeName(): string {
        return MonacoEditorDefaults.themeName
    }

    public load(): Promise<TMonacoApi> {
        if (!this.loading) {
            this.loading = this.start()
        }

        return this.loading
    }

    public fontFamily(): string {
        return MonacoThemeBuilder.fontFamily(this.tokens.read([MonacoThemeTokens.fontMono]))
    }

    public applyTheme(): void {
        if (!this.api) {
            return
        }

        // The theme is a class on <html> and another handler puts it there, so the
        // tokens are read a frame later rather than in whichever order the bus runs.
        setTimeout(() => this.defineTheme(), MonacoEditorDefaults.repaintDelayMs)
    }

    public addSchema(schema: TMonacoSchema): Promise<void> {
        const kept = this.schemas.filter(known => known.uri !== schema.uri)
        this.schemas = [...kept, schema]

        return Promise.resolve()
    }

    // Assembled rather than imported whole: the `monaco-editor` barrel registers all eighty
    // languages plus the css/html/json/typescript services, whose workers are nine megabytes.
    //
    // `configureMonacoYaml` is deliberately not called: monaco-yaml asks for its worker through
    // the pre-0.53 `createWebWorker({ moduleId, label, createData })`, and 0.56 has no channel
    // left for `createData` — the worker starts without schemas or settings and answers every
    // request with "Missing requestHandler", so validation, completion and hover are all dead
    // either way. Schemas keep being collected for whatever language service replaces it.
    private async start(): Promise<TMonacoApi> {
        const [monaco, { MonacoWorkers }] = await Promise.all([
            import('monaco-editor/editor'),
            import('@/application/services/monacoEditor/models/MonacoWorkers'),
            import('monaco-editor/features/register.all'),
            import('monaco-editor/languages/definitions/yaml/register'),
        ])

        MonacoWorkers.register()

        this.api = monaco as unknown as TMonacoApi
        this.defineTheme()

        return this.api
    }

    private defineTheme(): void {
        if (!this.api) {
            return
        }

        const values = this.tokens.read(MonacoThemeTokens.all())
        const dark = document.documentElement.classList.contains('dark')

        this.api.editor.defineTheme(
            MonacoEditorDefaults.themeName,
            MonacoThemeBuilder.build(values, dark) as never,
        )
        this.api.editor.setTheme(MonacoEditorDefaults.themeName)
    }
}
