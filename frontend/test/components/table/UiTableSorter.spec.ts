import { describe, expect, it } from 'vitest'
import { UiTableSorter } from '@/components/common/table/UiTableSorter'

type TRow = { name: string; restarts: number | null; ready: boolean }

const rows: TRow[] = [
    { name: 'api-10', restarts: 2, ready: true },
    { name: 'api-2', restarts: null, ready: false },
    { name: 'api-1', restarts: 11, ready: true },
]

describe('UiTableSorter', () => {
    it('orders text the way a human reads a numbered name', () => {
        const sorted = UiTableSorter.sort(rows, { key: 'name', direction: 'asc' })

        expect(sorted.map(row => row.name)).toEqual(['api-1', 'api-2', 'api-10'])
    })

    it('orders numbers numerically rather than as text', () => {
        const sorted = UiTableSorter.sort(rows, { key: 'restarts', direction: 'asc' })

        expect(sorted.map(row => row.restarts)).toEqual([2, 11, null])
    })

    it('keeps rows with no value at the back in both directions', () => {
        const ascending = UiTableSorter.sort(rows, { key: 'restarts', direction: 'asc' })
        const descending = UiTableSorter.sort(rows, { key: 'restarts', direction: 'desc' })

        expect(ascending[ascending.length - 1].restarts).toBeNull()
        expect(descending[0].restarts).toBe(11)
    })

    it('leaves the caller array alone and returns it unsorted without a sort', () => {
        const original = [...rows]
        const sorted = UiTableSorter.sort(rows, null)

        expect(rows).toEqual(original)
        expect(sorted).toEqual(original)
        expect(sorted).not.toBe(rows)
    })

    it('cycles a header through ascending, descending and unsorted', () => {
        const first = UiTableSorter.next(null, 'name')
        const second = UiTableSorter.next(first, 'name')
        const third = UiTableSorter.next(second, 'name')

        expect(first).toEqual({ key: 'name', direction: 'asc' })
        expect(second).toEqual({ key: 'name', direction: 'desc' })
        expect(third).toBeNull()
    })

    it('starts a different column ascending instead of continuing the cycle', () => {
        expect(UiTableSorter.next({ key: 'name', direction: 'desc' }, 'restarts'))
            .toEqual({ key: 'restarts', direction: 'asc' })
    })

    it('reports aria-sort only for the sorted column', () => {
        const sort = { key: 'name', direction: 'desc' } as const

        expect(UiTableSorter.ariaSort(sort, 'name')).toBe('descending')
        expect(UiTableSorter.ariaSort(sort, 'restarts')).toBe('none')
        expect(UiTableSorter.ariaSort(null, 'name')).toBe('none')
    })

    it('compares booleans and dates by their own order', () => {
        expect(UiTableSorter.compare(false, true)).toBeLessThan(0)
        expect(UiTableSorter.compare(new Date(2), new Date(1))).toBeGreaterThan(0)
    })
})
