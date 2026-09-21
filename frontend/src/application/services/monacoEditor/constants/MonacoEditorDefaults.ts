export class MonacoEditorDefaults {
    public static readonly themeName: string = 'kubiq'

    public static readonly language: string = 'yaml'

    public static readonly fontSize: number = 12

    public static readonly lineHeight: number = 18

    public static readonly tabSize: number = 2

    // One frame at 60 Hz.
    public static readonly repaintDelayMs: number = 16

    public static options(): Record<string, unknown> {
        return {
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            lineNumbersMinChars: 3,
            glyphMargin: true,
            folding: true,
            tabSize: MonacoEditorDefaults.tabSize,
            insertSpaces: true,
            wordWrap: 'off',
            renderWhitespace: 'selection',
            smoothScrolling: false,
            contextmenu: false,
            fixedOverflowWidgets: true,
            bracketPairColorization: { enabled: false },
            padding: { top: 8, bottom: 8 },
            guides: { indentation: true },
            scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
                useShadows: false,
            },
        }
    }
}
