import { inject, singleton } from 'tsyringe'
import type { MonacoYaml } from 'monaco-yaml'
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

    private yaml: MonacoYaml | null = null

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

    public async addSchema(schema: TMonacoSchema): Promise<void> {
        const kept = this.schemas.filter(known => known.uri !== schema.uri)
        this.schemas = [...kept, schema]

        await this.yaml?.update({ schemas: this.schemas, validate: true, completion: true, hover: true })
    }

    // Assembled rather than imported whole: the `monaco-editor` barrel registers all eighty
    // languages plus the css/html/json/typescript services, whose workers are nine megabytes.
    private async start(): Promise<TMonacoApi> {
        const [monaco, { configureMonacoYaml }, { MonacoWorkers }] = await Promise.all([
            import('monaco-editor/editor'),
            import('monaco-yaml'),
            import('@/application/services/monacoEditor/models/MonacoWorkers'),
            import('monaco-editor/features/register.all'),
            import('monaco-editor/languages/definitions/yaml/register'),
        ])

        MonacoWorkers.register()

        this.api = monaco as unknown as TMonacoApi
        this.defineTheme()

        this.yaml = configureMonacoYaml(monaco, {
            enableSchemaRequest: false,
            isKubernetes: true,
            format: { enable: true },
            validate: true,
            completion: true,
            hover: true,
            schemas: this.schemas,
        })

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
