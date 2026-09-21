import { describe, expect, it } from 'vitest'
import { UiTableColumns } from '@/components/common/table/UiTableColumns'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

const column = (key: string, extra: Partial<TUiTableColumn> = {}): TUiTableColumn => ({ key, title: key, ...extra })

describe('UiTableColumns', () => {
    it('hides every printer column the cluster marked as low priority', () => {
        const columns = [column('name', { locked: true }), column('node'), column('ip', { priority: 1 })]

        expect(UiTableColumns.defaultHidden(columns)).toEqual(['ip'])
    })

    it('caps the default-visible columns and hides the extras', () => {
        const columns = Array.from({ length: 10 }, (unused, index) => column(`c${index}`))

        expect(UiTableColumns.defaultHidden(columns)).toEqual(['c7', 'c8', 'c9'])
    })

    it('never hides a locked column, cap or no cap', () => {
        const columns = [
            ...Array.from({ length: 8 }, (unused, index) => column(`c${index}`)),
            column('state', { locked: true }),
            column('age', { locked: true, priority: 3 }),
        ]

        const hidden = UiTableColumns.defaultHidden(columns)

        expect(hidden).not.toContain('state')
        expect(hidden).not.toContain('age')
        expect(hidden).toEqual(['c7'])
    })

    it('reads a locked column as visible whatever the hidden list says', () => {
        expect(UiTableColumns.isVisible(column('age', { locked: true }), ['age'])).toBe(true)
        expect(UiTableColumns.isVisible(column('node'), ['node'])).toBe(false)
    })

    it('toggles a column in and out of the hidden list', () => {
        expect(UiTableColumns.toggle(column('node'), [], false)).toEqual(['node'])
        expect(UiTableColumns.toggle(column('node'), ['node'], true)).toEqual([])
        expect(UiTableColumns.toggle(column('node'), ['node'], false)).toEqual(['node'])
    })

    it('refuses to hide a locked column', () => {
        expect(UiTableColumns.toggle(column('name', { locked: true }), [], false)).toEqual([])
    })
})
