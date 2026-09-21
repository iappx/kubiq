import { UiTableColumns } from '@/components/common/table/UiTableColumns'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TKubeColumn } from '@/domain/models/kube'

export class ResourceColumns {
    public static readonly nameKey: string = 'name'

    public static readonly namespaceKey: string = 'namespace'

    public static readonly stateKey: string = 'state'

    public static readonly ageKey: string = 'createdAt'

    private static readonly widths: Record<string, string> = {
        [ResourceColumns.nameKey]: '22%',
        [ResourceColumns.namespaceKey]: '14%',
        [ResourceColumns.stateKey]: '140px',
        [ResourceColumns.ageKey]: '80px',
    }

    public static isLocked(key: string): boolean {
        return key === ResourceColumns.nameKey || key === ResourceColumns.stateKey || key === ResourceColumns.ageKey
    }

    public static map(columns: readonly TKubeColumn[]): TUiTableColumn[] {
        return columns.map(column => ResourceColumns.toUiColumn(column))
    }

    public static defaultHidden(columns: readonly TUiTableColumn[]): string[] {
        return UiTableColumns.defaultHidden(columns)
    }

    private static toUiColumn(column: TKubeColumn): TUiTableColumn {
        const mapped: TUiTableColumn = {
            key: column.key,
            title: column.title,
            locked: ResourceColumns.isLocked(column.key),
        }

        if (column.align) {
            mapped.align = column.align
        }
        if (column.priority !== undefined) {
            mapped.priority = column.priority
        }

        const width = ResourceColumns.widths[column.key]
        if (width) {
            mapped.width = width
        }

        return mapped
    }
}
