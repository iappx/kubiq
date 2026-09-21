export type TMonacoThemeData = {
    base: 'vs' | 'vs-dark'
    inherit: boolean
    rules: { token: string; foreground?: string; background?: string; fontStyle?: string }[]
    colors: Record<string, string>
}
