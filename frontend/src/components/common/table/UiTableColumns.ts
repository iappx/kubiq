import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

export class UiTableColumns {
    public static readonly visibleCap = 7

    public static defaultHidden(columns: readonly TUiTableColumn[], cap: number = UiTableColumns.visibleCap): string[] {
        const hidden: string[] = []
        let visible = 0

        for (const column of columns) {
            if (column.locked === true) {
                visible++
                continue
            }
            if ((column.priority ?? 0) > 0 || visible >= cap) {
                hidden.push(column.key)
                continue
            }
            visible++
        }

        return hidden
    }

    public static isVisible(column: TUiTableColumn, hidden: readonly string[]): boolean {
        return column.locked === true || !hidden.includes(column.key)
    }

    public static toggle(column: TUiTableColumn, hidden: readonly string[], visible: boolean): string[] {
        if (column.locked === true) {
            return [...hidden]
        }
        return visible
            ? hidden.filter(key => key !== column.key)
            : (hidden.includes(column.key) ? [...hidden] : [...hidden, column.key])
    }
}
