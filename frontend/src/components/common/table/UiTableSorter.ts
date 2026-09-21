import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import { UiTableValue } from '@/components/common/table/UiTableValue'

export class UiTableSorter {
    public static sort<T>(rows: readonly T[], sort: TUiTableSort | null): T[] {
        const ordered = [...rows]
        if (!sort) {
            return ordered
        }

        const sign = sort.direction === 'asc' ? 1 : -1
        return ordered.sort((left, right) => {
            const first = UiTableValue.read(left, sort.key)
            const second = UiTableValue.read(right, sort.key)

            // Ranked outside the direction, so a reversed sort does not float empty values to the top.
            const rank = UiTableSorter.emptyRank(first) - UiTableSorter.emptyRank(second)
            return rank !== 0 ? rank : sign * UiTableSorter.compare(first, second)
        })
    }

    public static next(current: TUiTableSort | null, key: string): TUiTableSort | null {
        if (!current || current.key !== key) {
            return { key, direction: 'asc' }
        }
        if (current.direction === 'asc') {
            return { key, direction: 'desc' }
        }
        return null
    }

    public static ariaSort(current: TUiTableSort | null, key: string): 'ascending' | 'descending' | 'none' {
        if (!current || current.key !== key) {
            return 'none'
        }
        return current.direction === 'asc' ? 'ascending' : 'descending'
    }

    public static compare(left: unknown, right: unknown): number {
        const leftEmpty = UiTableSorter.isEmpty(left)
        const rightEmpty = UiTableSorter.isEmpty(right)
        if (leftEmpty || rightEmpty) {
            return leftEmpty === rightEmpty ? 0 : (leftEmpty ? 1 : -1)
        }

        if (typeof left === 'number' && typeof right === 'number') {
            return left - right
        }
        if (typeof left === 'boolean' && typeof right === 'boolean') {
            return Number(left) - Number(right)
        }
        if (left instanceof Date && right instanceof Date) {
            return left.getTime() - right.getTime()
        }

        return UiTableValue.text(left).localeCompare(UiTableValue.text(right), undefined, {
            numeric: true,
            sensitivity: 'base',
        })
    }

    private static emptyRank(value: unknown): number {
        return UiTableSorter.isEmpty(value) ? 1 : 0
    }

    private static isEmpty(value: unknown): boolean {
        return value === null || value === undefined || value === ''
    }
}
