export type TUiTableColumn = {
    key: string
    title: string
    align?: 'left' | 'right'
    priority?: number
    sortable?: boolean
    locked?: boolean
    width?: string
}
