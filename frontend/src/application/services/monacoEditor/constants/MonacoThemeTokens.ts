export class MonacoThemeTokens {
    public static readonly background: string = '--background'

    public static readonly foreground: string = '--foreground'

    public static readonly muted: string = '--muted'

    public static readonly mutedForeground: string = '--muted-foreground'

    public static readonly primary: string = '--primary'

    public static readonly accent: string = '--accent'

    public static readonly destructive: string = '--destructive'

    public static readonly warning: string = '--warning'

    public static readonly border: string = '--border'

    public static readonly ring: string = '--ring'

    public static readonly popover: string = '--popover'

    public static readonly popoverForeground: string = '--popover-foreground'

    public static readonly fontMono: string = '--font-mono'

    public static readonly densityText: string = '--density-text'

    public static all(): string[] {
        return [
            MonacoThemeTokens.background,
            MonacoThemeTokens.foreground,
            MonacoThemeTokens.muted,
            MonacoThemeTokens.mutedForeground,
            MonacoThemeTokens.primary,
            MonacoThemeTokens.accent,
            MonacoThemeTokens.destructive,
            MonacoThemeTokens.warning,
            MonacoThemeTokens.border,
            MonacoThemeTokens.ring,
            MonacoThemeTokens.popover,
            MonacoThemeTokens.popoverForeground,
            MonacoThemeTokens.fontMono,
            MonacoThemeTokens.densityText,
        ]
    }
}
