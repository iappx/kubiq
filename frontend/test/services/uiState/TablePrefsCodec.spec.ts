import { describe, expect, it } from 'vitest'
import { TablePrefsCodec } from '@/application/services/uiState/models/TablePrefsCodec'
import type { TTablePrefs } from '@/application/services/uiState/types/TTablePrefs'

describe('TablePrefsCodec', () => {
    describe('parse', () => {
        it('returns an empty map for null, empty, invalid JSON, or non-object roots', () => {
            expect(TablePrefsCodec.parse(null)).toEqual({})
            expect(TablePrefsCodec.parse('')).toEqual({})
            expect(TablePrefsCodec.parse('   ')).toEqual({})
            expect(TablePrefsCodec.parse('{bad')).toEqual({})
            expect(TablePrefsCodec.parse('[]')).toEqual({})
            expect(TablePrefsCodec.parse('"text"')).toEqual({})
            expect(TablePrefsCodec.parse('42')).toEqual({})
            expect(TablePrefsCodec.parse('null')).toEqual({})
        })

        it('parses valid hiddenKeys and sort entries', () => {
            const raw = JSON.stringify({
                'catalog:clusters': {
                    hiddenKeys: ['authType', 'source'],
                    sort: { key: 'displayName', direction: 'asc' },
                },
                'v1:pods': {
                    hiddenKeys: [],
                    sort: null,
                },
            })

            expect(TablePrefsCodec.parse(raw)).toEqual({
                'catalog:clusters': {
                    hiddenKeys: ['authType', 'source'],
                    sort: { key: 'displayName', direction: 'asc' },
                },
                'v1:pods': {
                    hiddenKeys: [],
                    sort: null,
                },
            })
        })

        it('drops malformed fields and entries while preserving valid sibling fields', () => {
            const raw = JSON.stringify({
                '': { hiddenKeys: ['a'] },
                invalidEntry: 'not-an-object',
                emptyEntry: {},
                badHidden: { hiddenKeys: [123, 'a'], sort: { key: 'age', direction: 'desc' } },
                badSortDir: { hiddenKeys: ['ns', 'ns', ''], sort: { key: 'name', direction: 'up' } },
                badSortKey: { sort: { key: '', direction: 'asc' } },
                extraSortFields: { sort: { key: 'status', direction: 'asc', extra: true } },
            })

            expect(TablePrefsCodec.parse(raw)).toEqual({
                badHidden: { sort: { key: 'age', direction: 'desc' } },
                badSortDir: { hiddenKeys: ['ns'] },
                extraSortFields: { sort: { key: 'status', direction: 'asc' } },
            })
        })

        it('caps parsed entries at maxEntries', () => {
            const source: Record<string, TTablePrefs> = {}
            for (let i = 0; i < TablePrefsCodec.maxEntries + 35; i++) {
                source[`kind-${i}`] = { hiddenKeys: [`col-${i}`] }
            }

            const parsed = TablePrefsCodec.parse(JSON.stringify(source))

            expect(Object.keys(parsed)).toHaveLength(TablePrefsCodec.maxEntries)
        })
    })

    describe('serialize', () => {
        it('round-trips through parse and caps entries at maxEntries keeping newest entries', () => {
            const source: Record<string, TTablePrefs> = {}
            for (let i = 0; i < TablePrefsCodec.maxEntries + 10; i++) {
                source[`kind-${i}`] = {
                    hiddenKeys: [`col-${i}`],
                    sort: { key: 'name', direction: 'asc' },
                }
            }

            const serialized = TablePrefsCodec.serialize(source)
            const reparsed = TablePrefsCodec.parse(serialized)

            expect(Object.keys(reparsed)).toHaveLength(TablePrefsCodec.maxEntries)
            expect(reparsed['kind-0']).toBeUndefined()
            expect(reparsed[`kind-${TablePrefsCodec.maxEntries + 9}`]).toEqual({
                hiddenKeys: [`col-${TablePrefsCodec.maxEntries + 9}`],
                sort: { key: 'name', direction: 'asc' },
            })
        })
    })

    describe('resolveHiddenKeys', () => {
        const available = ['name', 'status', 'namespace', 'age', 'node', 'ip']
        const locked = ['name', 'status', 'age']
        const defaults = ['node', 'ip']

        it('returns a copy of defaultHidden when nothing is stored', () => {
            const resolved = TablePrefsCodec.resolveHiddenKeys(undefined, available, locked, defaults)

            expect(resolved).toEqual(['node', 'ip'])
            expect(resolved).not.toBe(defaults)
        })

        it('respects an explicitly empty stored list', () => {
            expect(TablePrefsCodec.resolveHiddenKeys([], available, locked, defaults)).toEqual([])
        })

        it('filters out unknown, locked, and duplicate keys', () => {
            const resolved = TablePrefsCodec.resolveHiddenKeys(
                ['name', 'removedCrdCol', 'namespace', 'status', 'ip', 'namespace', 'age'],
                available,
                locked,
                defaults,
            )

            expect(resolved).toEqual(['namespace', 'ip'])
        })
    })

    describe('mergeHiddenKeys', () => {
        const available = ['name', 'status', 'namespace', 'node', 'ip', 'age']

        it('preserves hidden keys for unavailable dynamic columns when toggling visible ones', () => {
            const merged = TablePrefsCodec.mergeHiddenKeys(
                ['cpu', 'memory', 'node'],
                ['ip'],
                available,
            )

            expect(merged).toEqual(['ip', 'cpu', 'memory'])
        })

        it('removes keys that are currently available and no longer hidden', () => {
            const merged = TablePrefsCodec.mergeHiddenKeys(
                ['node', 'ip', 'cpu'],
                [],
                [...available, 'cpu'],
            )

            expect(merged).toEqual([])
        })

        it('deduplicates keys, preserves order, and excludes empty strings', () => {
            const merged = TablePrefsCodec.mergeHiddenKeys(
                ['cpu', '', 'memory', 'cpu', 'ip'],
                ['ip', '', 'namespace', 'ip', 'cpu'],
                available,
            )

            expect(merged).toEqual(['ip', 'namespace', 'cpu', 'memory'])
        })

        it('handles an undefined previous list', () => {
            expect(TablePrefsCodec.mergeHiddenKeys(undefined, ['node', '', 'node', 'ip'], available)).toEqual([
                'node',
                'ip',
            ])
        })
    })

    describe('resolveSort', () => {
        const sortable = ['name', 'status', 'age']

        it('returns null when stored sort is null or undefined', () => {
            expect(TablePrefsCodec.resolveSort(undefined, sortable)).toBeNull()
            expect(TablePrefsCodec.resolveSort(null, sortable)).toBeNull()
        })

        it('returns null when the stored key is not sortable or no longer exists', () => {
            expect(TablePrefsCodec.resolveSort({ key: 'removedCol', direction: 'asc' }, sortable)).toBeNull()
        })

        it('returns a copy of the stored sort when its key is sortable', () => {
            const stored = { key: 'age', direction: 'desc' as const }
            const resolved = TablePrefsCodec.resolveSort(stored, sortable)

            expect(resolved).toEqual({ key: 'age', direction: 'desc' })
            expect(resolved).not.toBe(stored)
        })
    })
})
