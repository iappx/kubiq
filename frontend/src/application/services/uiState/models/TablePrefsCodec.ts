import type { TTablePrefs } from '@/application/services/uiState/types/TTablePrefs'
import type { TTableSortPref } from '@/application/services/uiState/types/TTableSortPref'

export class TablePrefsCodec {
    public static readonly maxEntries: number = 200

    public static parse(raw: string | null): Record<string, TTablePrefs> {
        if (raw === null || raw.trim() === '') {
            return {}
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch {
            return {}
        }

        if (!TablePrefsCodec.isRecord(parsed)) {
            return {}
        }

        const result: Record<string, TTablePrefs> = {}
        let count = 0

        for (const [tableKey, value] of Object.entries(parsed)) {
            if (count >= TablePrefsCodec.maxEntries) {
                break
            }
            if (!TablePrefsCodec.isValidTableKey(tableKey)) {
                continue
            }

            const entry = TablePrefsCodec.parseEntry(value)
            if (entry === null) {
                continue
            }

            result[tableKey] = entry
            count++
        }

        return result
    }

    public static serialize(map: Record<string, TTablePrefs>): string {
        const validEntries: Array<[string, TTablePrefs]> = []

        for (const [tableKey, value] of Object.entries(map)) {
            if (!TablePrefsCodec.isValidTableKey(tableKey)) {
                continue
            }

            const entry = TablePrefsCodec.parseEntry(value)
            if (entry === null) {
                continue
            }

            validEntries.push([tableKey, entry])
        }

        const capped = validEntries.length > TablePrefsCodec.maxEntries
            ? validEntries.slice(-TablePrefsCodec.maxEntries)
            : validEntries

        const normalized: Record<string, TTablePrefs> = {}
        for (const [tableKey, entry] of capped) {
            normalized[tableKey] = entry
        }

        return JSON.stringify(normalized)
    }

    public static resolveHiddenKeys(
        stored: readonly string[] | undefined,
        availableKeys: readonly string[],
        lockedKeys: readonly string[],
        defaultHidden: readonly string[],
    ): string[] {
        if (stored === undefined) {
            return [...defaultHidden]
        }

        const available = new Set(availableKeys)
        const locked = new Set(lockedKeys)
        const seen = new Set<string>()
        const resolved: string[] = []

        for (const key of stored) {
            if (available.has(key) && !locked.has(key) && !seen.has(key)) {
                seen.add(key)
                resolved.push(key)
            }
        }

        return resolved
    }

    public static mergeHiddenKeys(
        previous: readonly string[] | undefined,
        next: readonly string[],
        availableKeys: readonly string[],
    ): string[] {
        const available = new Set(availableKeys)
        const seen = new Set<string>()
        const merged: string[] = []

        for (const key of next) {
            if (key.length > 0 && !seen.has(key)) {
                seen.add(key)
                merged.push(key)
            }
        }

        if (previous !== undefined) {
            for (const key of previous) {
                if (key.length > 0 && !available.has(key) && !seen.has(key)) {
                    seen.add(key)
                    merged.push(key)
                }
            }
        }

        return merged
    }

    public static resolveSort(
        stored: TTableSortPref | null | undefined,
        sortableKeys: readonly string[],
    ): TTableSortPref | null {
        if (stored === null || stored === undefined) {
            return null
        }

        if (!sortableKeys.includes(stored.key)) {
            return null
        }

        return { key: stored.key, direction: stored.direction }
    }

    private static parseEntry(value: unknown): TTablePrefs | null {
        if (!TablePrefsCodec.isRecord(value)) {
            return null
        }

        const entry: TTablePrefs = {}

        if (TablePrefsCodec.isStringArray(value.hiddenKeys)) {
            entry.hiddenKeys = Array.from(new Set(value.hiddenKeys.filter(key => key.length > 0)))
        }

        if (value.sort === null) {
            entry.sort = null
        } else if (TablePrefsCodec.isSortPref(value.sort)) {
            entry.sort = { key: value.sort.key, direction: value.sort.direction }
        }

        if (entry.hiddenKeys === undefined && entry.sort === undefined) {
            return null
        }

        return entry
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value)
    }

    private static isStringArray(value: unknown): value is string[] {
        return Array.isArray(value) && value.every(item => typeof item === 'string')
    }

    private static isSortPref(value: unknown): value is TTableSortPref {
        if (!TablePrefsCodec.isRecord(value)) {
            return false
        }

        return typeof value.key === 'string'
            && value.key.length > 0
            && (value.direction === 'asc' || value.direction === 'desc')
    }

    private static isValidTableKey(key: string): boolean {
        return key.length > 0 && key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
    }
}
