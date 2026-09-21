export class UiTableCursor {
    public static move(keys: readonly string[], current: string | null, delta: number): string | null {
        if (keys.length === 0) {
            return null
        }

        const index = current === null ? -1 : keys.indexOf(current)
        if (index < 0) {
            return delta < 0 ? keys[keys.length - 1] : keys[0]
        }

        const next = Math.min(Math.max(index + delta, 0), keys.length - 1)
        return keys[next]
    }

    public static first(keys: readonly string[]): string | null {
        return keys.length > 0 ? keys[0] : null
    }

    public static last(keys: readonly string[]): string | null {
        return keys.length > 0 ? keys[keys.length - 1] : null
    }

    public static keep(keys: readonly string[], current: string | null): string | null {
        return current !== null && keys.includes(current) ? current : null
    }
}
