export class UiTableValue {
    public static read(row: unknown, key: string): unknown {
        if (row === null || typeof row !== 'object') {
            return undefined
        }
        return (row as Record<string, unknown>)[key]
    }

    public static text(value: unknown): string {
        if (value === null || value === undefined) {
            return ''
        }
        if (value instanceof Date) {
            return value.toISOString()
        }
        if (Array.isArray(value)) {
            return value.map(item => UiTableValue.text(item)).join(', ')
        }
        if (typeof value === 'object') {
            return ''
        }
        return String(value)
    }
}
