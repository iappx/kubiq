import type { TTableSortPref } from '@/application/services/uiState/types/TTableSortPref'

export type TTablePrefs = {
    hiddenKeys?: string[]
    sort?: TTableSortPref | null
}
