import { MonacoThemeTokens } from '@/application/services/monacoEditor/constants/MonacoThemeTokens'
import { MonacoHslColor } from '@/application/services/monacoEditor/models/MonacoHslColor'
import type { TMonacoThemeData } from '@/application/services/monacoEditor/types/TMonacoThemeData'

export class MonacoThemeBuilder {
    public static build(tokens: Record<string, string>, dark: boolean): TMonacoThemeData {
        const colour = (name: string, alpha: number = 1): string => MonacoHslColor.toHex(tokens[name] ?? '', alpha)

        return {
            base: dark ? 'vs-dark' : 'vs',
            inherit: true,
            rules: MonacoThemeBuilder.rules(colour),
            colors: MonacoThemeBuilder.colors(colour),
        }
    }

    public static fontFamily(tokens: Record<string, string>): string {
        return tokens[MonacoThemeTokens.fontMono] ?? 'monospace'
    }

    public static fontSize(tokens: Record<string, string>, fallback: number): number {
        const size = Number.parseFloat(tokens[MonacoThemeTokens.densityText] ?? '')

        return Number.isNaN(size) ? fallback : size
    }

    private static rules(colour: (name: string, alpha?: number) => string): TMonacoThemeData['rules'] {
        const key = MonacoThemeBuilder.bare(colour(MonacoThemeTokens.primary))
        const literal = MonacoThemeBuilder.bare(colour(MonacoThemeTokens.accent))
        const text = MonacoThemeBuilder.bare(colour(MonacoThemeTokens.foreground))
        const quiet = MonacoThemeBuilder.bare(colour(MonacoThemeTokens.mutedForeground))

        return [
            { token: '', foreground: text },
            { token: 'type', foreground: key },
            { token: 'key', foreground: key },
            { token: 'string', foreground: text },
            { token: 'string.yaml', foreground: text },
            { token: 'number', foreground: literal },
            { token: 'keyword', foreground: literal },
            { token: 'tag', foreground: literal },
            { token: 'comment', foreground: quiet, fontStyle: 'italic' },
            { token: 'delimiter', foreground: quiet },
            { token: 'operators', foreground: quiet },
        ]
    }

    private static colors(colour: (name: string, alpha?: number) => string): Record<string, string> {
        return {
            'editor.background': colour(MonacoThemeTokens.background),
            'editor.foreground': colour(MonacoThemeTokens.foreground),
            'editorCursor.foreground': colour(MonacoThemeTokens.primary),
            'editor.selectionBackground': colour(MonacoThemeTokens.primary, 0.28),
            'editor.inactiveSelectionBackground': colour(MonacoThemeTokens.primary, 0.14),
            'editor.selectionHighlightBackground': colour(MonacoThemeTokens.primary, 0.14),
            'editor.wordHighlightBackground': colour(MonacoThemeTokens.primary, 0.12),
            'editor.wordHighlightStrongBackground': colour(MonacoThemeTokens.primary, 0.18),
            'editor.findMatchBackground': colour(MonacoThemeTokens.accent, 0.35),
            'editor.findMatchHighlightBackground': colour(MonacoThemeTokens.accent, 0.2),
            'editor.lineHighlightBackground': colour(MonacoThemeTokens.muted, 0.55),
            'editor.lineHighlightBorder': '#00000000',
            'editorLineNumber.foreground': colour(MonacoThemeTokens.mutedForeground, 0.55),
            'editorLineNumber.activeForeground': colour(MonacoThemeTokens.foreground),
            'editorIndentGuide.background1': colour(MonacoThemeTokens.border),
            'editorIndentGuide.activeBackground1': colour(MonacoThemeTokens.primary, 0.45),
            'editorWhitespace.foreground': colour(MonacoThemeTokens.border),
            'editorGutter.background': colour(MonacoThemeTokens.background),
            'editorBracketMatch.background': colour(MonacoThemeTokens.primary, 0.18),
            'editorBracketMatch.border': colour(MonacoThemeTokens.primary, 0.45),
            'editorError.foreground': colour(MonacoThemeTokens.destructive),
            'editorWarning.foreground': colour(MonacoThemeTokens.warning),
            'editorInfo.foreground': colour(MonacoThemeTokens.primary),
            'editorOverviewRuler.border': '#00000000',
            'editorWidget.background': colour(MonacoThemeTokens.popover),
            'editorWidget.foreground': colour(MonacoThemeTokens.popoverForeground),
            'editorWidget.border': colour(MonacoThemeTokens.border),
            'editorSuggestWidget.background': colour(MonacoThemeTokens.popover),
            'editorSuggestWidget.foreground': colour(MonacoThemeTokens.popoverForeground),
            'editorSuggestWidget.border': colour(MonacoThemeTokens.border),
            'editorSuggestWidget.selectedBackground': colour(MonacoThemeTokens.muted),
            'editorSuggestWidget.highlightForeground': colour(MonacoThemeTokens.primary),
            'editorHoverWidget.background': colour(MonacoThemeTokens.popover),
            'editorHoverWidget.foreground': colour(MonacoThemeTokens.popoverForeground),
            'editorHoverWidget.border': colour(MonacoThemeTokens.border),
            'input.background': colour(MonacoThemeTokens.background),
            'input.foreground': colour(MonacoThemeTokens.foreground),
            'input.border': colour(MonacoThemeTokens.border),
            'focusBorder': colour(MonacoThemeTokens.ring),
            'scrollbarSlider.background': colour(MonacoThemeTokens.border, 0.8),
            'scrollbarSlider.hoverBackground': colour(MonacoThemeTokens.mutedForeground, 0.5),
            'scrollbarSlider.activeBackground': colour(MonacoThemeTokens.mutedForeground, 0.7),
            'scrollbar.shadow': '#00000000',
            'widget.shadow': '#00000000',
        }
    }

    // A token rule wants the six hex digits without the hash; a colour does not.
    private static bare(hex: string): string {
        return hex.replace('#', '').slice(0, 6)
    }
}
