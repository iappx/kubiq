export class UiTableSelection {
    public static toggle(selected: readonly string[], key: string): string[] {
        return selected.includes(key)
            ? selected.filter(item => item !== key)
            : [...selected, key]
    }

    public static range(selected: readonly string[], keys: readonly string[], anchor: string, target: string): string[] {
        const from = keys.indexOf(anchor)
        const to = keys.indexOf(target)
        if (from < 0 || to < 0) {
            return UiTableSelection.toggle(selected, target)
        }

        const start = Math.min(from, to)
        const end = Math.max(from, to)
        const result = [...selected]
        for (let i = start; i <= end; i++) {
            if (!result.includes(keys[i])) {
                result.push(keys[i])
            }
        }
        return result
    }

    public static togglePage(selected: readonly string[], keys: readonly string[]): string[] {
        if (UiTableSelection.isPageSelected(selected, keys)) {
            return selected.filter(item => !keys.includes(item))
        }

        const result = [...selected]
        for (const key of keys) {
            if (!result.includes(key)) {
                result.push(key)
            }
        }
        return result
    }

    public static isPageSelected(selected: readonly string[], keys: readonly string[]): boolean {
        return keys.length > 0 && keys.every(key => selected.includes(key))
    }

    public static isPagePartial(selected: readonly string[], keys: readonly string[]): boolean {
        return keys.some(key => selected.includes(key)) && !UiTableSelection.isPageSelected(selected, keys)
    }
}
