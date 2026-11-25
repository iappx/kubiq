export type TUiTableColumn = {
    key: string
    title: string
    align?: 'left' | 'right'
    format?: 'date'
    priority?: number
    sortable?: boolean
    locked?: boolean
    width?: string
}
